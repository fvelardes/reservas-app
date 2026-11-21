export default function VersionBadge({ health }) {
  const ok = health?.status === "ok";
  return (
    <span className={`badge ${ok ? "badge-ok" : "badge-off"}`} title="Versión que reporta /api/health">
      <span className="punto" aria-hidden="true" />
      {ok ? `API ${health.version}` : "API sin respuesta"}
    </span>
  );
}
