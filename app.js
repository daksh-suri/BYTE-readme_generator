const express = require('express');
const path = require('path');
const axios = require('axios');
const session = require('express-session');
require('dotenv').config();
const { PredictionServiceClient } = require('@google-cloud/aiplatform');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'static')));
app.use(session({ secret: 'BYTE_SECRET', resave: false, saveUninitialized: true }));

const CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

const client = new PredictionServiceClient();

async function Gemini_helpr(draftReadme) {
  try {
    const project = process.env.GCP_PROJECT_ID;
    const location = 'us-central1';
    const model = process.env.GEMINI_MODEL_ID;

    const prompt = `
Here is a GitHub repository draft README:
${draftReadme}
Please generate a professional README file in Markdown format.
`;

    const [response] = await client.predict({
      endpoint: `projects/${project}/locations/${location}/publishers/google/models/${model}`,
      instances: [{ content: prompt }],
      parameters: { temperature: 0.7, max_output_tokens: 800 },
    });

    const aiOutput = response.predictions[0].content || draftReadme;
    return aiOutput;

  } catch (err) {
    console.error("Gemini API failed:", err.message);
    return draftReadme;
  }
}

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

app.post('/generate-md', async (req, res) => {
  try {
    const { url } = req.body;
    const token = req.session.token;
    if (!token) return res.status(401).json({ error: "Not authenticated. Please login first." });

    const arr = url.split('/');
    const repo = arr.pop();
    const owner = arr.pop();
    const headers = { Authorization: `token ${token}` };

    const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}`, { headers });
    const contentsRes = await axios.get(`https://api.github.com/repos/${owner}/${repo}/contents`, { headers });
    const files = contentsRes.data.map(f => f.name);

    let techStack = [];
    if (response.data.language) techStack.push(response.data.language);
    if (files.includes('package.json')) techStack.push('Node.js');
    if (files.includes('requirements.txt')) techStack.push('Python');
    if (files.includes('pom.xml')) techStack.push('Java');
    if (files.includes('Gemfile')) techStack.push('Ruby');
    if (files.includes('composer.json')) techStack.push('PHP');
    if (files.includes('Dockerfile')) techStack.push('Docker');
    if (files.includes('Makefile')) techStack.push('Make');

    const draftReadme = `# ${response.data.name || "Project Title"}

## 📌 Description
${response.data.description || "No description provided."}

## ✨ Features
- Feature 1
- Feature 2
- Feature 3

## 🛠 Installation Guide
\`\`\`bash
git clone ${response.data.clone_url || "REPO_URL"}
cd ${response.data.name || "PROJECT_FOLDER"}
npm install
\`\`\`

## 💻 Tech Stack
${techStack.map(t => `- ${t}`).join('\n')}

## 📂 Project Structure
\`\`\`
${response.data.name || "PROJECT_FOLDER"}/
├── src/
├── public/
├── package.json
└── README.md
\`\`\`

## 📜 License
${response.data.license?.name || "MIT"}
`;

    const polishedReadme = await Gemini_helpr(draftReadme);
    res.json({ readmeContent: polishedReadme });

  } catch (err) {
    console.error(err.message);
    if (err.response?.status === 401) {
      res.status(401).json({ error: "GitHub token invalid or expired. Please log in again." });
    } else {
      res.status(500).json({ error: "Repository not found or other error" });
    }
  }
});

app.listen(4444);
