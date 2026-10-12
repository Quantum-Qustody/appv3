import { useEffect } from "react";
import { BLOG_POSTS } from "../blog.jsx";

const fmt = (d, long) =>
  new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: long ? "long" : "short", year: "numeric" });

export function ResearchIndex({ go }) {
  const posts = [...BLOG_POSTS].sort((a, b) => (a.date < b.date ? 1 : -1));
  return (
    <main id="main" className="section" style={{ borderTop: 0 }}>
      <div className="wrap">
        <div className="sh">
          <h1 style={{ fontSize: "var(--text-3xl)", fontWeight: 600 }}>Research</h1>
          <p>Notes from the team on agent governance, evidence and the post-quantum transition.</p>
        </div>
        <ul className="posts">
          {posts.map((p) => (
            <li className="post" key={p.id}>
              <a href={`/research/${p.id}`} onClick={(e) => { e.preventDefault(); go(`/research/${p.id}`); }}>
                <span className="post__meta">{fmt(p.date)}<br />{p.readMins} min read</span>
                <span>
                  <h2>{p.title}</h2>
                  <p>{p.excerpt}</p>
                  <p className="post__meta" style={{ marginTop: "var(--space-2)" }}>{p.author}, {p.role}</p>
                </span>
                <span className="post__tag">{p.tag}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}

export function ResearchArticle({ id, go }) {
  const post = BLOG_POSTS.find((p) => p.id === id);
  useEffect(() => { if (post) document.title = `${post.title} · Q² Research`; }, [post]);
  if (!post) {
    return (
      <main id="main" className="section" style={{ borderTop: 0 }}>
        <div className="wrap article">
          <h1>Article not found</h1>
          <p style={{ marginTop: "var(--space-4)" }}><a href="/research" onClick={(e) => { e.preventDefault(); go("/research"); }}>Back to research</a></p>
        </div>
      </main>
    );
  }
  return (
    <main id="main" className="section" style={{ borderTop: 0 }}>
      <article className="wrap article">
        <button type="button" className="back" onClick={() => go("/research")}>← All research</button>
        <div className="article__meta" style={{ marginTop: "var(--space-8)" }}>
          <span>{post.tag}</span><span>{fmt(post.date, true)}</span><span>{post.readMins} min read</span>
        </div>
        <h1>{post.title}</h1>
        <p className="article__meta" style={{ marginBottom: "var(--space-10)" }}>{post.author}, {post.role}</p>
        <div className="article__body">
          {post.body.map((b, i) =>
            b.h ? <h2 key={i}>{b.h}</h2> : b.q ? <blockquote key={i}>{b.q}</blockquote> : <p key={i}>{b.p}</p>
          )}
        </div>
      </article>
    </main>
  );
}
