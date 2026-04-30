import { useEffect, useState } from "react";
import { api } from "../api";

export default function FlagsReportsPage() {
  const [reports, setReports] = useState([]);
  const [statusFilter, setStatusFilter] = useState("All");
  const [resolutionNotes, setResolutionNotes] = useState({});
  const [message, setMessage] = useState("");

  async function loadReports() {
    const allReports = await api.reports();
    setReports(Array.isArray(allReports) ? allReports : []);
  }

  useEffect(() => {
    loadReports().catch((err) => setMessage(err.message));
  }, []);

  const visibleReports = reports.filter((report) => statusFilter === "All" || report.status === statusFilter);

  async function changeStatus(reportId, status) {
    try {
      const note = resolutionNotes[reportId] || "";
      const updated = await api.updateReportStatus(reportId, status, note);

      setReports((prev) => prev.map((report) => (String(report._id) === String(reportId) ? updated : report)));
      setMessage(`Report #${String(reportId).slice(-6)} updated to ${status}`);
    } catch (err) {
      setMessage(err.message || "Failed to update report status");
    }
  }

  return (
    <>
      <div className="header">
        <div className="header-title">
          <h1>Flags / Reports</h1>
          <p>Monitor buyer reports and flagged activity</p>
        </div>
      </div>

      {message ? <div className="alert success" style={{ marginBottom: 16 }}>{message}</div> : null}

      <div className="filter-tabs" style={{ marginBottom: 16 }}>
        {["All", "Open", "UnderReview", "Resolved", "Dismissed"].map((status) => (
          <button
            key={status}
            className={`filter-btn ${statusFilter === status ? "active" : ""}`}
            onClick={() => setStatusFilter(status)}
          >
            {status}
          </button>
        ))}
      </div>

      <div className="reports-list">
        {visibleReports.length ? visibleReports.map((report) => (
          <div className="report-card" key={report._id}>
            <div className="report-header">
              <h3>{report.reason}</h3>
              <span className="status-badge status-pending">{report.status || "Open"}</span>
            </div>
            <div className="report-meta">Reported user: {report.reportedUserId?.name || report.reportedUserId?.email || String(report.reportedUserId)}</div>
            <div className="report-meta">Reported by: {report.reportedBy?.name || report.reportedBy?.email || String(report.reportedBy)}</div>
            <p>{report.details || "No extra details provided."}</p>

            <div className="form-group" style={{ marginTop: 12 }}>
              <label>Resolution Note</label>
              <input
                placeholder="Optional moderation note"
                value={resolutionNotes[report._id] ?? report.resolutionNote ?? ""}
                onChange={(e) =>
                  setResolutionNotes((prev) => ({
                    ...prev,
                    [report._id]: e.target.value
                  }))
                }
              />
            </div>

            <div className="form-actions">
              {['Open', 'UnderReview', 'Resolved', 'Dismissed'].map((status) => (
                <button
                  key={`${report._id}-${status}`}
                  type="button"
                  className="btn-edit"
                  onClick={() => changeStatus(report._id, status)}
                >
                  Mark {status}
                </button>
              ))}
            </div>
          </div>
        )) : <div className="empty-message"><div className="empty-message-icon">📭</div><p>No reports yet</p></div>}
      </div>
    </>
  );
}
