const express = require('express');
const path = require('path');
const axios = require('axios');
const session = require('express-session');
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'static')));
app.use(session({ secret: 'BYTE_SECRET', resave: false, saveUninitialized: true }));

const CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const GEMINI_MODEL = process.env.GEMINI_MODEL_ID;

async function Gemini_helpr(prompt) {
  try {
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (err) {
    console.error("Gemini API failed:", err.message);
    return "Failed to generate README.";
  }
}

// readme.md generator 
async function generateReadme(repoData, contents) {
  console.log(repoData);
  // console.log(contents);
  const filesList = contents.map(f => f.name).join(", ");
  // console.log(filesList);

  // prompt for tech stack, project structure, description, features, license
  const prompt = `
You are a README generator.
Using the following repository information, generate a complete README in Markdown format.
- Include a "Tech Stack" section with all technologies/frameworks used (bullet points).
- Include a "Project Structure" section as a tree based on these files: ${filesList}.
- Include a "License" section if a license exists in the repository.
- Include "Description" and "Features" sections.
- Return ONLY the Markdown content.
`;
  return await Gemini_helpr(prompt);
}

// oauth routes 
app.get('/auth/github', (req, res) => {
  const redirectUrl = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&scope=repo`;
  res.redirect(redirectUrl);
});

app.get('/auth/github/callback', async (req, res) => {
  const code = req.query.code;
  try {
    const tokenRes = await axios.post(
      'https://github.com/login/oauth/access_token',
      { client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code },
      { headers: { Accept: 'application/json' } }
    );
    req.session.token = tokenRes.data.access_token;
    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.send("OAuth failed");
  }
});

app.get('/auth/status', (req, res) => {
  res.json({ authenticated: !!req.session.token });
});


// main function to generate readme.md file 
app.post('/generate-md', async (req, res) => {
  try {
    const { url, isPrivate } = req.body;
    const githubUrlRegex = /^https?:\/\/github\.com\/([^\/]+)\/([^\/]+)\/?$/;
    const match = url.match(githubUrlRegex);
    if (!match) return res.status(400).json({ error: "Invalid GitHub repository URL format" });

    const owner = match[1];
    const repo = match[2];

    const headers = {};
    if (isPrivate) {
      const token = req.session.token;
      if (!token) return res.status(401).json({ error: "Authenticate first for private repos" });
      headers.Authorization = `token ${token}`;
    }

    const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}`, { headers });
    const res_content = await axios.get(`https://api.github.com/repos/${owner}/${repo}/contents`, { headers });

    const finalReadme = await generateReadme(response.data, res_content.data);
    res.json({ readmeContent: finalReadme });
  } catch (err) {
    console.error(err.message);
    if (err.response?.status === 401) res.status(401).json({ error: "Authentication required or token expired" });
    else if (err.response?.status === 404) res.status(404).json({ error: "Repository not found" });
    else res.status(500).json({ error: "Error generating README" });
  }
});

app.listen(4444);


// Code	Name
// 400	Bad Request	Client sent a malformed or invalid request.
// 401	Unauthorized	Authentication required or failed.
// 403	Forbidden	Server refuses to authorize the request.
// 404	Not Found	Requested resource does not exist.
// 405	Method Not Allowed	HTTP method not supported for this resource.
// 408	Request Timeout	Server timed out waiting for the request.
// 409	Conflict	Request conflicts with current resource state.
// 415	Unsupported Media Type	Server does not support the request’s media type.
// 429	Too Many Requests	Client sent too many requests in a short time.
// 500	Internal Server Error	Generic server-side error.
// 502	Bad Gateway	Invalid response from an upstream server.
// 503	Service Unavailable	Server temporarily unavailable (overload/maintenance).
// 504	Gateway Timeout	Upstream server did not respond in time.
