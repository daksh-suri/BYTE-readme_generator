const btn = document.getElementById('generateBtn');
const input = document.getElementById('repoInput');
const output = document.getElementById('readmeOutput');
const privateCheckbox = document.getElementById('privateRepo');
const authBtn = document.getElementById('githubAuthBtn');

const isValidGitHubURL = (url) => /^https?:\/\/github\.com\/[^\/]+\/[^\/]+\/?$/.test(url);


function toggleAuthBtn() {
  const isAuthenticated = sessionStorage.getItem('authenticated') === '1';
  authBtn.style.display = (privateCheckbox.checked && !isAuthenticated) ? 'inline-block' : 'none';
}

fetch('/auth/status')
  .then(r => r.json())
  .then(s => {
    if (s.authenticated) {
      sessionStorage.setItem('authenticated', '1');
    }
    toggleAuthBtn(); 
  })
  .catch(() => {
    toggleAuthBtn(); 
  });

privateCheckbox.addEventListener('change', toggleAuthBtn);

btn.onclick = async () => {
  const url = input.value.trim();
  if (!url) return alert("Enter a repository URL!");
  if (!isValidGitHubURL(url)) return alert("Invalid GitHub URL format!");

  if (privateCheckbox.checked && !sessionStorage.getItem('authenticated')) {
    return alert("Please authenticate first for private repositories!");
  }

  btn.disabled = true;
  btn.textContent = "⏳ Generating...";
  try {
    const res = await axios.post('/generate-md', { url, isPrivate: privateCheckbox.checked });
    const readme = res.data.readmeContent;
    output.textContent = readme;

    let link = document.getElementById('downloadLink');
    const blob = new Blob([readme], { type: "text/markdown" });
    link.href = URL.createObjectURL(blob);
    link.download = `${url.split('/').pop() || "README"}.md`;
    link.textContent = "Download README";
    link.style.display = "inline-block";
  } catch (err) {
    console.error(err);
    alert(err.response?.data?.error || "Error generating README");
  } finally {
    btn.disabled = false;
    btn.textContent = "Generate README";
  }
};

input.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') btn.click();
});
