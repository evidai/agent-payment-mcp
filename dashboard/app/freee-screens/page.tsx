import Link from "next/link";

export default function FreeeScreensIndex() {
  return (
    <div style={{ fontFamily: "sans-serif", padding: 40 }}>
      <h1>freee App Store Screenshots</h1>
      <ul>
        {[1, 2, 3, 4, 5].map((n) => (
          <li key={n} style={{ marginBottom: 8 }}>
            <Link href={`/freee-screens/${n}`}>Screen {n}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
