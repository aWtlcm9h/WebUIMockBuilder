import { useState } from 'react';
import { useStore, type CommentTarget } from '../model/store';
import type { Comment } from '../model/types';

export function CommentsBox({ target, comments, placeholder }: { target: CommentTarget; comments: Comment[] | undefined; placeholder?: string }) {
  const [text, setText] = useState('');
  const add = () => {
    const t = text.trim();
    if (!t) return;
    useStore.getState().addComment(target, t);
    setText('');
  };
  return (
    <div className="comments">
      {(comments ?? []).map((c) => (
        <div key={c.id} className="comment">
          <div className="comment-text">{c.text}</div>
          <button className="icon-btn" title="削除" onClick={() => useStore.getState().removeComment(target, c.id)}>
            ×
          </button>
        </div>
      ))}
      <textarea
        className="f-input"
        rows={2}
        value={text}
        placeholder={placeholder ?? '意図・挙動・制約などをメモ（Ctrl/⌘+Enter で追加）'}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) add();
        }}
      />
      <button className="btn sm" onClick={add} disabled={!text.trim()}>
        コメントを追加
      </button>
    </div>
  );
}
