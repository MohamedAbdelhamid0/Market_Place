import { useEffect, useState } from "react";
import { api } from "../api";

const statuses = ["Placed", "Processing", "Preparing", "Shipping", "Delivered", "Cancelled"];

export default function OrdersManagementPage() {
  const [orders, setOrders] = useState([]);
  const [details, setDetails] = useState("");
  const [ratingDrafts, setRatingDrafts] = useState({});
  const [message, setMessage] = useState("");

  async function load() {
    const data = await api.myOrders();
    setOrders(data);
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);

  async function updateStatus(orderId, status) {
    await api.updateOrderStatus(orderId, status);
    setMessage(`Order #${String(orderId).slice(-6)} updated to ${status}`);
    await load();
  }

  async function flagBuyer(order) {
    await api.flagUser({
      reportedUserId: order.buyerId,
      reason: "Package Not Received",
      details,
      orderId: order._id
    });
    setMessage(`Buyer from order #${String(order._id).slice(-6)} flagged`);
    setDetails("");
  }

  async function rateBuyer(order, rating, comment) {
    await api.rateBuyer({
      orderId: order._id,
      buyerId: order.buyerId,
      rating,
      comment
    });
    setMessage(`Buyer rating saved for order #${String(order._id).slice(-6)}`);
    await load();
  }

  function getRatingDraft(order) {
    const existing = ratingDrafts[order._id];
    if (existing) return existing;
    return {
      rating: order.buyer_rating ? String(order.buyer_rating) : "",
      comment: order.buyer_rating_comment || ""
    };
  }

  return (
    <>
      <div className="header">
        <div className="header-title">
          <h1>Orders Management</h1>
          <p>Update order status, rate buyers, and report issues</p>
        </div>
      </div>

      {message ? <div className="alert success" style={{ marginBottom: 16 }}>{message}</div> : null}

      <div className="form-row">
        <div className="form-group">
          <label>Flag Type</label>
          <input value="Package Not Received" disabled />
        </div>
        <div className="form-group">
          <label>Flag Details</label>
          <input placeholder="Optional supporting details" value={details} onChange={(e) => setDetails(e.target.value)} />
        </div>
      </div>

      <div className="orders-list">
        {orders.map((order) => (
          <div className="order-card" key={order._id}>
            <div className="order-info">
              <h3>Order #{String(order._id).slice(-6)}</h3>
              <div className="order-meta">Buyer: {order.buyerName || "Unknown"}</div>
              <div className="order-meta">Product: {order.product || "Unknown"}</div>
            </div>

            <div className="order-actions">
              <div className="form-group">
                <label>Status</label>
                <select className="order-status-select" value={order.status} onChange={(e) => updateStatus(order._id, e.target.value)}>
                  {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Buyer Rating</label>
                <select
                  value={getRatingDraft(order).rating}
                  onChange={(e) =>
                    setRatingDrafts((prev) => ({
                      ...prev,
                      [order._id]: { ...getRatingDraft(order), rating: e.target.value }
                    }))
                  }
                >
                  <option value="">Rate buyer...</option>
                  <option value="1">1 - Poor</option>
                  <option value="2">2 - Fair</option>
                  <option value="3">3 - Good</option>
                  <option value="4">4 - Very Good</option>
                  <option value="5">5 - Excellent</option>
                </select>
              </div>
              <div className="form-group">
                <label>Rating Note</label>
                <input
                  placeholder="Optional rating note"
                  value={getRatingDraft(order).comment}
                  onChange={(e) =>
                    setRatingDrafts((prev) => ({
                      ...prev,
                      [order._id]: { ...getRatingDraft(order), comment: e.target.value }
                    }))
                  }
                />
              </div>
            </div>

            <div className="order-footer">
              <div className="order-price">${Number(order.totalPrice || 0).toFixed(2)}</div>
              <div className="form-actions">
                <button
                  className="btn-rating-save"
                  onClick={() => {
                    const draft = getRatingDraft(order);
                    const rating = Number(draft.rating || 0);
                    const comment = draft.comment || "";
                    if (!rating || rating < 1 || rating > 5) {
                      setMessage("Please select rating 1-5 before saving");
                      return;
                    }
                    rateBuyer(order, rating, comment).catch((err) => setMessage(err.message));
                  }}
                >
                  Save Buyer Rating
                </button>
                <button className="btn-flag" onClick={() => flagBuyer(order).catch((err) => setMessage(err.message))}>Flag Buyer</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
