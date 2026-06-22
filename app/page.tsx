import { ConnectionTester } from "./connection-tester";

export default function Home() {
  const projectId = process.env.PROJECT_ID;
  const location =
    process.env.PROJECT_LOCATION ??
    process.env.LOCATION ??
    process.env.VERTEX_LOCATION ??
    "us-central1";

  return (
    <main>
      <section className="shell">
        <div className="eyebrow">
          <span className="pulse" />
          Vertex AI diagnostic
        </div>

        <h1>Let’s see if the model answers.</h1>
        <p className="intro">
          This sends tiny server-side prompts to the selected Vertex AI models.
          Your API key remains inside the Next.js server and is never returned
          to the browser.
        </p>

        <div className="config">
          <div>
            <span>API key</span>
            <strong>{process.env.API_KEY ? "Detected" : "Missing"}</strong>
          </div>
          <div>
            <span>Project</span>
            <strong>{projectId || "Not set"}</strong>
          </div>
          <div>
            <span>Location</span>
            <strong>{location}</strong>
          </div>
          <div>
            <span>Model panel</span>
            <strong>4 diagnostics</strong>
          </div>
        </div>

        <ConnectionTester />
      </section>
    </main>
  );
}
