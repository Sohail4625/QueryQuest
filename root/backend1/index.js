const express = require("express");
const cors = require("cors");
const redis = require("redis");
const bodyParser = require("body-parser");
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
      console.error("Error connecting to Elasticsearch:", err);
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

async function getUrls(userQuery) {
  const response = await elasticClient.search({
    index: "urls_data",
    body: {
      query: {
        bool: {
          should: [
            {
              match: {
                title: {
                  query: userQuery,
                  boost: 3, // Boost title relevance
                  operator: "or",
                  analyzer: "my_analyzer"
                }
              }
            },
            {
              match: {
                description: {
                  query: userQuery,
                  boost: 2,
                  operator: "or", // Boost description relevance
                  analyzer: "my_analyzer"
                }
              }
            },
            {
              match: {
                keywords: {
                  query: userQuery,
                  boost: 2,
                  operator: "or", // Boost keywords relevance
                  analyzer: "my_analyzer"
                }
              }
            },
            {
              match: {
                text_in_page: {
                  query: userQuery,
                  boost: 1,
                  operator: "or", // Lower boost for general text
                  analyzer: "my_analyzer"
                }
              }
            },
            {
              match: {
                url: {
                  query: userQuery,
                  boost: 1, // Equal weight to URL matching
                  analyzer: "my_analyzer"
                }
              }
            }
          ],
          minimum_should_match: 1, // At least one field must match
        }
      }
    }
  });  
  return response;
}

const app = express();

app.use(cors());
app.use(bodyParser.json());

const urls = [
  "https://en.wikipedia.org/w/api.php?action=opensearch&limit=10&namespace=0&format=json&search=",
  "https://newsapi.org/v2/everything?apiKey=b4463c7c9ded47efa013a52b255cdfbd&q=",
  "https://api.stackexchange.com/2.3/search?order=desc&sort=activity&site=stackoverflow&intitle=",
  "https://dev.to/api/articles?page=1&per_page=10&tag=",
];

let devtoUrl = "https://dev.to/api/articles?page=1&per_page=10&tag=";

async function pushURLS(newurls) {
  try {
    await client.rPush("urls_list", newurls);
  } catch (err) {
    console.log("Error occured: ", err);
  }
}

app.get("/", async (req, res) => {
  const size = await client.sCard("visited_urls");
  res.json({ message: size });
});

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
const LOCK_VALUE = "unique_lock_value";
const LOCK_KEY = "my_lock";
const LOCK_EXPIRE_TIME = 10;
app.post("/", async (req, res) => {
  const text = req.body.text;
  const textClean = text
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "")
    .trim();
  const q = textClean.split(/\s+/).filter((word) => word.length > 0);
  const newurls = urls.map((url) => {
    for (i = 0; i < q.length; i++) {
      if (i == q.length - 1) {
        url += q[i];
      } else {
        url += q[i];
        url += "+";
      }
    }
    return url;
  });
  newurls[3] = urls[3];
  for (i = 0; i < q.length; i++) {
    newurls[3] += q[i];
  }
  let urls_list = [];
  // Loop through newurls and fetch data based on index i
  for (let i = 0; i < newurls.length; i++) {
    try {
      const response = await fetch(newurls[i]);

      // Check if the response is ok (status code in the range 200-299)
      if (!response.ok) {
        throw new Error(
          `Network response was not ok. Status: ${response.status}`
        );
      }
      const data = await response.json();
      if (i === 0) {
        urls_list = urls_list.concat(data[3].slice(0, 2));
      }
      if (i === 1) {
        const links = data.articles.map((article) => article.url);
        urls_list = urls_list.concat(links.slice(0, 2));
      }
      if (i === 2) {
        const links = data.items.map((page) => page.link);
        urls_list = urls_list.concat(links.slice(0, 2));
      }
      if (i === 3) {
        const links = data.map((article) => article.url);
        urls_list = urls_list.concat(links.slice(0, 2));
      }
    } catch (err) {
      console.log("Error fetching urls", err);
    }
  }
  console.log(urls_list)
  await pushURLS(urls_list);
  async function checkSize() {
    const size = await client.lLen("urls_list");
    if (size == 0) {
      const response = await getUrls(textClean);
      console.log("Done");
      clearInterval(interval);
      (response.hits.hits.map(obj => {
        console.log(obj._source.url);
      }));
      const list = response.hits.hits.map(obj => {
        let data = new Object();
        data.url = obj._source.url;
        data.title = obj._source.title;
        data.content = obj._source.text_in_page.slice(0,100);
        return (data);
      });
      console.log(list);
      res.json({ message: list });
    }
  }
  const interval = setInterval(checkSize, 1000);
});

app.listen(5000);
