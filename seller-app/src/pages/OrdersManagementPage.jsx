import { useEffect, useState } from "react";
import { api } from "../api";

const statuses = ["Placed", "Processing", "Preparing", "Shipping", "Delivered", "Cancelled"];

export default function OrdersManagementPage() {
  const [orders, setOrders] = useState([]);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");

  async function load() {
    const data = await api.myOrders();
    setOrders(data);
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);

  async function updateStatus(orderId, status) {
    await api.updateOrderStatus(orderId, status);
    await load();
  }

  async function flagBuyer(order) {
    await api.flagUser({
      reportedUserId: order.buyerId,
      reason: reason || "Payment or behavior issue",
      details,
      orderId: order._id
    });
    alert("Buyer flagged");
    setReason("");
    setDetails("");
  }

  async function rateBuyer(order, rating, comment) {
    await api.rateBuyer({
      orderId: order._id,
      buyerId: order.buyerId,
      rating,
      comment
    });
    alert("Buyer rated successfully");
    await load();
  }

  return (
    <>
      <div className="header">
        <div className="header-title">
          <h1>Orders Management</h1>
          <p>Update order status, rate buyers, and report issues</p>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Flag Reason</label>
          <input placeholder="Example: Unpaid order or behavior issue" value={reason} onChange={(e) => setReason(e.target.value)} />
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
                <select id={`buyer-rating-${order._id}`} defaultValue={order.buyer_rating || ""}>
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
                <input id={`buyer-rating-comment-${order._id}`} placeholder="Optional rating note" defaultValue={order.buyer_rating_comment || ""} />
              </div>
            </div>

            <div className="order-footer">
              <div className="order-price">${Number(order.totalPrice || 0).toFixed(2)}</div>
              <div className="form-actions">
                <button
                  className="btn-save"
                  onClick={() => {
                    const rating = Number(document.getElementById(`buyer-rating-${order._id}`)?.value || 0);
                    const comment = document.getElementById(`buyer-rating-comment-${order._id}`)?.value || "";
                    if (!rating || rating < 1 || rating > 5) {
                      alert("Please select rating 1-5");
                      return;
                    }
                    rateBuyer(order, rating, comment).catch((err) => alert(err.message));
                  }}
                >
                  Save Buyer Rating
                </button>
                <button className="btn-flag" onClick={() => flagBuyer(order)}>Flag Buyer</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
