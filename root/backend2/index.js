const express = require("express");
const cors = require("cors");
const redis = require("redis");
const app = express();
const puppeteer = require("puppeteer");
const Robots_Parser = require("robots-parser");
const { Client } = require("@elastic/elasticsearch");

indexSettings = {
  settings: {
    analysis: {
      analyzer: {
        my_analyzer: {
          type: "custom",
          tokenizer: "standard",
          character_filter: ["html_strip"],
          filter: ["lowercase", "stop", "asciifolding", "porter_stem"],
        },
      },
    },
  },
  mappings: {
    properties: {
      url: {
        type: "keyword",
      },
      title: {
        type: "text",
        analyzer: "my_analyzer",
      },
      keywords: {
        type: "text",
        analyzer: "keyword",
      },
      description: {
        type: "text",
        analyzer: "my_analyzer",
      },
      text_in_page: {
        type: "text",
        analyzer: "my_analyzer",
      },
    },
  },
};

let elasticClient;

setTimeout(async () => {
  elasticClient = new Client({
    node: "http://elastic:Sohail@2004@elasticsearch:9200",
  });
  async function checkConnection() {
    try {
      const ping = await elasticClient.ping();
      console.log("Connected to Elasticsearch.");
    } catch (err) {
      console.error("Error connecting to Elasticsearch:");
    }
  }
  checkConnection();
  const exist = await elasticClient.indices.exists({ index: "urls_data" });
  if (exist) {
    console.log("Exists");
  } else {
    const response = await elasticClient.indices.create({
      index: "urls_data",
      body: indexSettings,
    });
    console.log("Created base");
    console.log(response);
  }
}, 40000);

app.use(cors());
const client = redis.createClient({
  url: "redis://redis:6379",
});

(async () => {
  try {
    await client.connect();
  } catch (err) {
    console.error("Failed to connect to Redis:", err);
  }
})();

async function checkCrawlPermission(url, userAgent = "*") {
  try {
    const response = await fetch(new URL("/robots.txt", url).href);
    if (!response.ok) {
      throw new Error(`Failed to fetch robots.txt: ${response.statusText}`);
    }
    const robotsTxt = await response.text();
    const robots = Robots_Parser(url, robotsTxt);
    const canCrawl = robots.isAllowed(url, userAgent);
    return canCrawl;
  } catch (error) {
    console.error("Error checking crawl permission:");
    return true;
  }
}

async function scrapedata(url) {
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle2" });
    const metadata = await page.evaluate(() => {
      const titleElement = document.querySelector("title");
      const descriptionElement = document.querySelector(
        'meta[name="description"]'
      );
      const keywordsElement = document.querySelector('meta[name="keywords"]');

      const title = titleElement ? titleElement.textContent : null;
      const description = descriptionElement
        ? descriptionElement.getAttribute("content")
        : null;
      const keywords = keywordsElement
        ? keywordsElement.getAttribute("content")
        : null;

      const headingTags = Array.from(
        document.querySelectorAll("h1, h2, h3, h4, h5, h6")
      ).map((h) => h.textContent);
      const paraTags = Array.from(document.querySelectorAll("p")).map(
        (p) => p.textContent
      );
      const LinkTags = Array.from(document.querySelectorAll("a")).map((a) =>
        a.getAttribute("href")
      );
      return {
        title,
        description,
        keywords,
        headingTags: headingTags.length > 0 ? headingTags : null,
        paraTags: paraTags.length > 0 ? paraTags : null,
        linkTags: LinkTags.length > 0 ? LinkTags.slice(0, 10) : null,
      };
    });
    await browser.close();
    return metadata;
  } catch (err) {
    return "Error";
  }
}

const LOCK_VALUE = "unique_lock_value";
const LOCK_KEY = "my_lock";
const LOCK_EXPIRE_TIME = 10;
async function acquireLock(lockKey, lockTimeout) {
  try {
    const result = await client.set(lockKey, LOCK_VALUE, {
      NX: true,
      EX: lockTimeout,
    });
    return result === "OK";
  } catch (err) {
    console.error("Error acquiring lock:", err);
    return false;
  }
}

const releaseLockScript = `
  if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('DEL', KEYS[1])
  else
    return 0
  end
`;

async function accessListSafely() {
  const lockAcquired = await acquireLock(LOCK_KEY, LOCK_EXPIRE_TIME);
  let url = "";
  if (!lockAcquired) {
    return;
  }
  try {
    url = await client.lPop("urls_list");
  } catch (err) {
    console.error("Error accessing/modifying list:", err);
  } finally {
    const lockReleased = await releaseLock(LOCK_KEY);
    if (lockReleased) {
    } else {
      console.log("Failed to release lock or lock already expired");
    }
  }
  return url;
}

async function accessListSafelyInsert(urls_list) {
  const lockAcquired = await acquireLock(LOCK_KEY, LOCK_EXPIRE_TIME);
  if (!lockAcquired) {
    return;
  }
  try {
    const size = await client.lLen("urls_list");
    if (size) await client.rPush("urls_list", urls_list);
  } catch (err) {
    console.error("Error accessing/modifying list:", err);
  } finally {
    const lockReleased = await releaseLock(LOCK_KEY);
    if (lockReleased) {
    } else {
      console.log("Failed to release lock or lock already expired");
    }
  }
}

async function releaseLock(lockKey) {
  try {
    const result = await client.eval(releaseLockScript, {
      keys: [lockKey],
      arguments: [LOCK_VALUE],
    });
    return result === 1;
  } catch (err) {
    console.error("Error releasing lock:", err);
    return false;
  }
}

async function checkElastic(url) {
  const response = await elasticClient.search({
    index: "urls_data",
    body: {
      query: {
        match: {
          url: {
            query: url,
          },
        },
      },
    },
    filter_path: "hits.total.value",
  });
  return response;
}

function checkURL(url) {
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
}

function getTextData(url_data) {
  let p = url_data.paraTags.join(" ");
  const h = url_data.headingTags.join(" ");
  let str = (p + h).replace(/\s+/g, " ").trim();
  return str;
}

async function clearDatabase() {
  const lockAcquired = await acquireLock(LOCK_KEY, LOCK_EXPIRE_TIME);
  let url = "";
  if (!lockAcquired) {
    return;
  }
  try {
    const res1 = await client.del("urls_list");
    const res2 = await client.del("visited_urls");
  } catch (err) {
    console.error("Error deleting list:", err);
  } finally {
    const lockReleased = await releaseLock(LOCK_KEY);
    if (lockReleased) {
    } else {
      console.log("Failed to release lock or lock already expired");
    }
  }
  return url;
}

async function start() {
  const setSize = await client.sCard("visited_urls");
  // console.log(setSize);
  if (setSize >= 15) {
    await clearDatabase();
  }
  const size = await client.lLen("urls_list");
  if (size) {
    const url = await accessListSafely();
    let perm;
    if (url) {
      if (checkURL(url)) {
        perm = await checkCrawlPermission(url);
      }
    }
    if (perm && checkURL(url)) {
      const elascheck = await checkElastic(url);
      if (!elascheck.hits.total.value) {
        try {
          const url_data = await scrapedata(url);
          const text_data = getTextData(url_data);
          const data = {
            url: url,
            title: url_data.title || "",
            description: url_data.description || "",
            keywords: url_data.keywords || "",
            text_in_page: text_data || "",
          };
          const response = await elasticClient.index({
            index: "urls_data",
            document: data,
          });
          const ssize = await client.lLen("urls_list");
          if (ssize) await client.sAdd("visited_urls", url);
          url_data.linkTags.forEach(async (link) => {
            if (checkURL(link)) {
              const response = await checkElastic(link);

              if (!response.hits.total.value) {
                await accessListSafelyInsert(link);
              }
            } else {
              linkFull = new URL(url);
              base = linkFull.origin;
              newlink = new URL(link, base);
              const response = await checkElastic(newlink.href);
              if (!response.hits.total.value) {
                await accessListSafelyInsert(newlink.href);
              }
            }
          });
        } catch (err) {
          console.log("Error occured in scraping");
        }
      }
    }
  }
}

const interval = setInterval(start, 500);
