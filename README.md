# QueryQuest
## Description
**QueryQuest** is a robust, scalable, and distributed web crawler and search engine designed to efficiently index and search a specific set of URLs. Utilizing the power of modern technologies like Express.js, Puppeteer, Elasticsearch, Redis, Docker, and React.js, QueryQuest delivers exceptional performance and efficiency.

At its core, QueryQuest utilizes Puppeteer to execute its crawling algorithm, navigating through the specified URLs and extracting relevant data. To enhance scalability and optimize resource utilization, Docker is employed to create multiple instances of the crawler, enabling efficient load balancing for crawling tasks. Redis serves as a reliable communication channel between these instances, ensuring seamless information exchange and maintaining data integrity through robust lock mechanisms. The vast amount of indexed URL data is efficiently stored and managed using Elasticsearch, a powerful search engine platform.

To demonstrate its exceptional performance, QueryQuest has achieved an impressive average response time of 5 seconds per query, even when crawling 40 URLs simultaneously with just 3 crawlers. This remarkable efficiency highlights the system's ability to handle demanding workloads and deliver accurate results in a timely manner.

## Features
- Easily add or remove seed urls from where the web crawling starts.
- Create multiple instances of the crawler to balance the load and increase the depth of urls crawled and decrease the response time for a query.
- Proper lock mechanisms for proper and efficient urls crawling.
- Search results are displayed in the order of relevance.
- Continuous development with more and more searches since more and more urls get added into the database, so the searching becomes more faster.

## Tools and Technologies 
- **Express.js:** For apis routing and processing requests.
- **React:** For building the search engine web page.
- **Puppeteer:** For crawling of the web pages and extracting useful information.
- **Elasticsearch:** For storing, indexing and searching the crawled urls data.
- **Redis:** For maintaining a url queue(urls to be crawled), maintaining a set of visited urls to not crawl the same url again and again and communication between multiple crawler instances.
- **Docker:** To containerize the crawlers, react, elasticsearch, redis and create multiple instances of the crawler for load balancing.

## Working 
- Whenever a search query is sent to the backend, a set of seed urls are added to the redis queue.
- As the urls are added to the queue, one of the crawlers acquires lock on the queue and pops the url, crawls it, then adds the new urls to the queue and releases the lock.
- The data of the crawled url is added to the elasticsearch to index.
- The crawled urls are added to the visited urls set of redis.
- Once the set hits a specfic number the list and the set are cleared and hence the crawling stops until new urls are added to the list. The results are searched in the elasticsearch and shown to the user based on the relevance.
- All the crawlers are connected to a single redis and elasticsearch container.

## Installation and Setup Guide
- Ensure that you have docker installed on your system.
- Open the terminal
- Go to the root directory of the project `QueryQuest\root`.
- To build the containers run `docker-compose build` command.
- To run the containers run `docker-compose up` command.
- To build and run using a single command, use `docker-compose up --build`
- If you are using a mac or linux system then append sudo infront of these commands `sudo docker-compose up --build`
- Wait for the message `Connected to Elasticsearch` to appear in the terminal, once it appears the search engine is ready to take commands.
- [Demo Video](https://youtu.be/GbhM2IWamlY)
- Go to `http:\\localhost:80` to see the website
- If you want to use more seed urls of your choice go to index.js of the backend1 folder and add them in the urls list and make sure they are in the proper format such that the query gets appended to the end. For example `https://en.wikipedia.org/w/api.php?action=opensearch&limit=10&namespace=0&format=json&search=`.
- If you wish to add more crawlers, just add more instances of backend2 in the docker-compose.yaml file in the root directory.
- To change the total number of urls being crawled change the size of the set of visited_urls to your choice in line 285 in index.js of backend2

## Further development 
- The project can be deployed using Kuberenetes to manage the containers on AWS or Google Cloud Platforms.
- It can be developed as a multi user system, handling queries from multiple users.
