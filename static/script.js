const btn = document.getElementById('generateBtn');
const input = document.getElementById('repoInput');
const output = document.getElementById('readmeOutput');

btn.onclick = async () => {
  try {
    const url = input.value.trim();
    if (!url) return alert("Enter a repository URL!");

    const res = await axios.post('/generate-md', { url });
    const readme = res.data.readmeContent;

    output.textContent = readme;
    const blob = new Blob([readme], { type: "text/markdown" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${url.split('/').pop() || "README"}.md`;
    link.textContent = "Download README";
    document.body.appendChild(link);

  } catch (err) {
    console.error(err);
    alert(err.response?.data?.error || "Error generating README");
  }
};
