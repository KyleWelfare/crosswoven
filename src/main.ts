import "./style.css";

const app: HTMLDivElement | null = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Mount point #app not found");
app.innerHTML = "<h1>Crosswoven</h1><p>Work in progress.</p>";
