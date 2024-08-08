#!/usr/bin/env node
const { Command } = require("commander");
const puppeteer = require("puppeteer");
const cheerio = require("cheerio");
const { subMinutes, isAfter, subHours } = require("date-fns");

const accounts = [
  "https://twitter.com/Mr_Derivatives",
  "https://twitter.com/warrior_0719",
  "https://twitter.com/ChartingProdigy",
  "https://twitter.com/allstarcharts",
  "https://twitter.com/yuriymatso",
  "https://twitter.com/TriggerTrades",
  "https://twitter.com/AdamMancini4",
  "https://twitter.com/CordovaTrades",
  "https://twitter.com/Barchart",
  "https://twitter.com/RoyLMattox"
];

const scrapeTweets = async () => {
  try {
    const browser = await launchBrowser();
    let allTweets = [];

    for (const account of accounts) {
      const page = await openPage(browser);
      await navigateToAcc(page, account);
      await loadAllTweets(page);
      const tweets = await extractTweets(page);
      allTweets = allTweets.concat(tweets);
    }

    await browser.close();

    const intervalMinutes = 300000;
    const filteredTweets = filterTweetsByDate(allTweets, intervalMinutes);
    const wordCounts = countSymbols(filteredTweets);

    const output = taskOutput(wordCounts, intervalMinutes);
    console.log(output);

    return output;
  } catch (error) {
    console.error("Error:", error);
    return [];
  }
};

const launchBrowser = async () => {
  return await puppeteer.launch({ headless: true });
};

const openPage = async (browser) => {
  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36"
  );
  return page;
};

const navigateToAcc = async (page, url) => {
  await page.goto(url, { waitUntil: "networkidle2" });
};

const loadAllTweets = async (page) => {
  let previousHeight = await page.evaluate("document.body.scrollHeight");
  while (true) {
    await scrollDown(page);
    const currentHeight = await page.evaluate("document.body.scrollHeight");
    if (currentHeight === previousHeight) break;
    previousHeight = currentHeight;
  }
};

const scrollDown = async (page) => {
  await page.evaluate(() => window.scrollBy(0, window.innerHeight));
  await new Promise((resolve) => setTimeout(resolve, 3000));
};

const extractTweets = async (page) => {
  const content = await page.content();
  const $ = cheerio.load(content);

  let tweets = [];

  $('div[data-testid="tweetText"]').each((index, element) => {
    const tweetText = $(element).find("span").text();
    const time = $(element).parents("article").find("time").attr("datetime");
    if (tweetText && time) {
      const tweetDate = new Date(time);
      tweets.push({ text: tweetText, date: tweetDate });
    }
  });
  return tweets;
};

const filterTweetsByDate = (tweets, intervalMinutes) => {
  const timeNow = subHours(new Date(), 2);
  const intervalStart = subMinutes(timeNow, intervalMinutes);
  return tweets.filter((tweet) => isAfter(new Date(tweet.date), intervalStart));
};

const countSymbols = (tweets) => {
  const wordCounts = {};
  const regex = /\$([a-zA-Z]{3,4})\b/g;

  tweets.forEach((tweet) => {
    const matches = tweet.text.match(regex);
    if (matches) {
      matches.forEach((match) => {
        if (wordCounts[match]) {
          wordCounts[match]++;
        } else {
          wordCounts[match] = 1;
        }
      });
    }
  });

  return wordCounts;
};

const taskOutput = (wordCounts, intervalMinutes) => {
  return Object.keys(wordCounts)
    .map((key) => {
      return `"${key}" was mentioned "${wordCounts[key]}" times in the last "${intervalMinutes}" minutes.`;
    })
    .join("\n");
};

scrapeTweets();
