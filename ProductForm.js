import { useState } from "react";

export default function ProductForm() {

  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [image, setImage] = useState("");

  const handleImage = (file) => {
    if (file instanceof File) {
      setImage(URL.createObjectURL(file));
    }
  };

  const handleFileChange = (e) => {
    handleImage(e.target.files?.[0]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    handleImage(e.dataTransfer.files?.[0]);
  };

  const handleDragOver = (e) => e.preventDefault();

  return (
    <div>
      <div className="form-group">
        <label>Initial rating</label>

        <div className="stars">
          {[...Array(5)].map((_, i) => {
            const starValue = i + 1;

            return (
              <div key={i} className="star-wrapper">
                <span
                  className="half-star"
                  onClick={() => setRating(starValue - 0.5)}
                  onMouseEnter={() => setHover(starValue - 0.5)}
                  onMouseLeave={() => setHover(0)}
                />
                <span
                  className="half-star"
                  onClick={() => setRating(starValue)}
                  onMouseEnter={() => setHover(starValue)}
                  onMouseLeave={() => setHover(0)}
                />

                <span className="star-icon">
                  {(hover || rating) >= starValue
                    ? "★"
                    : (hover || rating) >= starValue - 0.5
                      ? "⯨"
                      : "☆"}
                </span>
              </div>
            );
          })}
        </div>

        <p>{rating} / 5</p>
      </div>

      <div className="form-group">
        <label>Product Image</label>

        <div
          className="image-frame"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          {image ? (
            <img src={image} alt="preview" />
          ) : (
            <div className="placeholder">
              Drag image here or click
            </div>
          )}

          <input type="file" accept="image/*" onChange={handleFileChange} />
        </div>
      </div>
    </div>
  );
}
