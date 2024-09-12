const express = require('express');
const puppeteer = require('puppeteer');
const { Parser } = require('json2csv');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files (CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

async function fetchPAAData(searchTerm, countryCode) {
  const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(searchTerm)}&hl=${countryCode}`;

  // Launch Puppeteer browser
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto(googleUrl);
  
  // Wait for the PAA section to load
  await page.waitForSelector('.related-question-pair');

  // Scrape PAA questions
  const paaData = await page.evaluate(() => {
    let questions = [];
    const paaElements = document.querySelectorAll('.related-question-pair');

    paaElements.forEach((element, index) => {
      const question = element.querySelector('.JCzEY').innerText;
      questions.push({ question, subQuestions: [] });

      // Simulate expanding PAA to get sub-questions
      element.click();

      // Collect sub-questions
      const subQuestionEls = element.querySelectorAll('.related-question-pair');
      subQuestionEls.forEach(subEl => {
        const subQuestion = subEl.querySelector('.JCzEY').innerText;
        questions[index].subQuestions.push(subQuestion);
      });
    });
    return questions;
  });

  await browser.close();
  return paaData;
}

// Serve homepage
app.get('/', (req, res) => {
  res.render('index');
});

// Handle form submission
app.post('/scrape', async (req, res) => {
  const { searchTerm, country } = req.body;

  try {
    const paaData = await fetchPAAData(searchTerm, country);
    res.render('results', { searchTerm, country, paaData });
  } catch (error) {
    res.status(500).send("Error fetching PAA data.");
  }
});

// Handle CSV download
app.post('/download-csv', (req, res) => {
  const { searchTerm, country, paaData } = req.body;

  const parser = new Parser({
    fields: ['searchTerm', 'country', 'question', 'subQuestion'],
  });

  const csvData = paaData.map((entry) => {
    return entry.subQuestions.map((subQuestion) => ({
      searchTerm,
      country,
      question: entry.question,
      subQuestion,
    }));
  }).flat();

  const csv = parser.parse(csvData);

  res.header('Content-Type', 'text/csv');
  res.attachment('paa-data.csv');
  res.send(csv);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
