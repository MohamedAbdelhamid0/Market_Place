import { useEffect, useState } from "react";
import { api } from "../api";

export default function FlagsReportsPage() {
  const [reports, setReports] = useState([]);

  useEffect(() => {
    api.reports().then(setReports).catch(console.error);
  }, []);

  return (
    <>
      <div className="header">
        <div className="header-title">
          <h1>Flags / Reports</h1>
          <p>Monitor buyer reports and flagged activity</p>
        </div>
      </div>

      <div className="reports-list">
        {reports.length ? reports.map((report) => (
          <div className="report-card" key={report._id}>
            <div className="report-header">
              <h3>{report.reason}</h3>
              <span className="status-badge status-pending">Open</span>
            </div>
            <div className="report-meta">Reported user: {report.reportedUserId?.name || report.reportedUserId?.email || String(report.reportedUserId)}</div>
            <div className="report-meta">Reported by: {report.reportedBy?.name || report.reportedBy?.email || String(report.reportedBy)}</div>
            <p>{report.details || "No extra details provided."}</p>
          </div>
        )) : <div className="empty-message"><div className="empty-message-icon">📭</div><p>No reports yet</p></div>}
      </div>
    </>
  );
}
