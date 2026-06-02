import React, { useEffect, useRef, useState } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Eraser,
  Heading1,
  Heading2,
  Sparkles,
  RefreshCw,
  Image as ImageIcon,
  Loader2,
} from 'lucide-react';
import { uploadReportImage } from '../../services/storageService';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  uid: string;
  date: string;
  placeholder?: string;
  disabled?: boolean;
}

const MAX_IMAGE_DIMENSION = 800;
const IMAGE_QUALITY = 0.8;

/**
 * Compresses and resizes an editor image attachment, returning a Blob.
 */
function processEditorImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;

      if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
        if (width > height) {
          height = Math.round((height * MAX_IMAGE_DIMENSION) / width);
          width = MAX_IMAGE_DIMENSION;
        } else {
          width = Math.round((width * MAX_IMAGE_DIMENSION) / height);
          height = MAX_IMAGE_DIMENSION;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create image blob'));
          }
        },
        'image/jpeg',
        IMAGE_QUALITY
      );
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

const TEMPLATES = [
  {
    name: '🎯 Daily Standup',
    description: 'Yesterday, Today, and Blockers',
    html: `<h3>🎯 <strong>DAILY STANDUP REPORT</strong></h3><p><strong>✅ Yesterday's Accomplishments:</strong></p><ul><li>Completed core functionality integrations...</li><li>Fixed outstanding dashboard layout alignment issues.</li></ul><p><strong>🚀 Today's Focus:</strong></p><ul><li>Verify real-time synchronizations.</li><li>Conduct final accessibility adjustments.</li></ul><p><strong>⚠️ Blockers:</strong></p><ul><li>None at this time.</li></ul>`
  },
  {
    name: '⚙️ Engineering Log',
    description: 'Code architecture, hotfixes, & metrics',
    html: `<h3>⚙️ <strong>ENGINEERING &amp; SYS-OPS LOG</strong></h3><p><strong>🛠️ Systems Modified:</strong></p><ul><li>Refactored authentication redirects and session listeners.</li></ul><p><strong>🧪 Test Coverage &amp; Performance:</strong></p><ul><li>Unit test status: <strong>Pass (100%)</strong></li><li>Vite build speed: <strong>2.45s compilation time</strong></li></ul><p><strong>🐛 Hotfixes &amp; Patches:</strong></p><ul><li>Patched CSRF token expiration intervals.</li></ul>`
  },
  {
    name: '🏆 Founder Update',
    description: 'Milestones, key KPIs & capital status',
    html: `<h3>🏆 <strong>FOUNDER STATUS UPDATE</strong></h3><p><strong>📈 Core Milestones Reached:</strong></p><ul><li>Acquired early validation feedback from first cohort users.</li><li>Finalized system architecture transitions.</li></ul><p><strong>📊 Key Metrics &amp; Growth KPIs:</strong></p><ul><li>Active sessions growth: <strong>+18% WoW</strong></li><li>Server transaction response time: <strong>48ms median</strong></li></ul><p><strong>💸 Operations &amp; Runway:</strong></p><ul><li>Quarterly operating cash flow optimized.</li></ul>`
  }
];

export default function RichTextEditor({ value, onChange, uid, date, placeholder = 'Start writing your premium daily report document here...' }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [showTemplates, setShowTemplates] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Sync state from editorRef to Counters
  const updateCounts = () => {
    if (!editorRef.current) return;
    const text = editorRef.current.innerText || '';
    setCharCount(text.length);
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    setWordCount(words);
  };

  // Sync value prop to innerHTML on mount and only when needed
  useEffect(() => {
    if (!editorRef.current) return;
    // Only update innerHTML if it is completely different to prevent cursor resetting
    if (editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '';
      updateCounts();
    }
  }, [value]);

  const handleInput = () => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    onChange(html);
    updateCounts();
  };

  // Helper to execute native formatting commands
  const executeCommand = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
      updateCounts();
    }
  };

  // Handle uploading and inserting image into the canvas
  const handleUploadAndInsertImage = async (file: File) => {
    if (!uid || !date) return;
    setUploadingImage(true);
    try {
      // 1. Process/compress image
      const compressedBlob = await processEditorImage(file);
      const filename = `report-img-${Date.now()}.jpg`;

      // 2. Upload to storage
      const imageUrl = await uploadReportImage(uid, date, compressedBlob, filename);

      // 3. Insert into contentEditable
      editorRef.current?.focus();
      // Embed with professional styling
      const imageHtml = `<img src="${imageUrl}" alt="Report Attachment" class="rounded-xl border border-[hsl(var(--border-subtle))]/30 shadow-md my-4 max-w-full block hover:scale-[1.01] transition-transform duration-200" />`;
      document.execCommand('insertHTML', false, imageHtml);

      if (editorRef.current) {
        onChange(editorRef.current.innerHTML);
        updateCounts();
      }
    } catch (err) {
      console.error('Failed to upload inline report image:', err);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleUploadAndInsertImage(file);
    }
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  // Clipboard Interception for Pasting Screenshots/Images directly (Ultra-Premium UX)
  const handlePaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          await handleUploadAndInsertImage(file);
        }
        break;
      }
    }
  };

  const handleInjectTemplate = (templateHtml: string) => {
    if (editorRef.current) {
      editorRef.current.innerHTML = templateHtml;
      onChange(templateHtml);
      updateCounts();
    }
    setShowTemplates(false);
  };

  const handleClearAll = () => {
    if (confirm('Are you sure you want to clear your current document draft?')) {
      if (editorRef.current) {
        editorRef.current.innerHTML = '';
        onChange('');
        updateCounts();
      }
    }
  };

  return (
    <div className="flex flex-col rounded-2xl border border-[hsl(var(--border-subtle))]/30 overflow-hidden bg-[hsl(var(--bg-elevated))]/40 backdrop-blur-md shadow-2xl">
      {/* Hidden file input for images */}
      <input
        type="file"
        ref={imageInputRef}
        accept="image/*"
        onChange={handleImageFileChange}
        className="hidden"
      />

      {/* 3D Skeuomorphic Document Processor Toolbar */}
      <div className="flex flex-wrap items-center gap-1.5 p-3 border-b border-[hsl(var(--border-subtle))]/20 bg-[hsl(var(--bg-sidebar))]/60 backdrop-blur-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
        {/* Basic formatting group */}
        <div className="flex items-center gap-0.5 rounded-lg skeuo-well p-1 border border-[hsl(var(--border-subtle))]/10 shrink-0">
          <button
            type="button"
            onClick={() => executeCommand('bold')}
            className="h-8 w-8 min-w-0 p-0 flex items-center justify-center rounded hover:bg-[hsla(var(--accent),0.15)] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] transition-all active:scale-95 cursor-pointer"
            title="Bold (Ctrl+B)"
          >
            <Bold size={15} />
          </button>
          <button
            type="button"
            onClick={() => executeCommand('italic')}
            className="h-8 w-8 min-w-0 p-0 flex items-center justify-center rounded hover:bg-[hsla(var(--accent),0.15)] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] transition-all active:scale-95 cursor-pointer"
            title="Italic (Ctrl+I)"
          >
            <Italic size={15} />
          </button>
          <button
            type="button"
            onClick={() => executeCommand('underline')}
            className="h-8 w-8 min-w-0 p-0 flex items-center justify-center rounded hover:bg-[hsla(var(--accent),0.15)] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] transition-all active:scale-95 cursor-pointer"
            title="Underline (Ctrl+U)"
          >
            <Underline size={15} />
          </button>
          <button
            type="button"
            onClick={() => executeCommand('strikeThrough')}
            className="h-8 w-8 min-w-0 p-0 flex items-center justify-center rounded hover:bg-[hsla(var(--accent),0.15)] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] transition-all active:scale-95 cursor-pointer"
            title="Strikethrough"
          >
            <Strikethrough size={15} />
          </button>
        </div>

        {/* Paragraph & Headings group */}
        <div className="flex items-center gap-0.5 rounded-lg skeuo-well p-1 border border-[hsl(var(--border-subtle))]/10 shrink-0">
          <button
            type="button"
            onClick={() => executeCommand('formatBlock', '<h1>')}
            className="h-8 w-9 min-w-0 p-0 flex items-center justify-center rounded hover:bg-[hsla(var(--accent),0.15)] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] font-extrabold text-[10px] uppercase tracking-wide transition-all active:scale-95 cursor-pointer"
            title="Heading 1"
          >
            <Heading1 size={15} />
          </button>
          <button
            type="button"
            onClick={() => executeCommand('formatBlock', '<h2>')}
            className="h-8 w-9 min-w-0 p-0 flex items-center justify-center rounded hover:bg-[hsla(var(--accent),0.15)] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] font-extrabold text-[10px] uppercase tracking-wide transition-all active:scale-95 cursor-pointer"
            title="Heading 2"
          >
            <Heading2 size={15} />
          </button>
          <button
            type="button"
            onClick={() => executeCommand('formatBlock', '<p>')}
            className="h-8 px-2 flex items-center justify-center rounded hover:bg-[hsla(var(--accent),0.15)] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] font-bold text-[10px] uppercase tracking-wider transition-all active:scale-95 cursor-pointer"
            title="Normal Paragraph"
          >
            Body
          </button>
        </div>

        {/* Lists & Alignment group */}
        <div className="flex items-center gap-0.5 rounded-lg skeuo-well p-1 border border-[hsl(var(--border-subtle))]/10 shrink-0">
          <button
            type="button"
            onClick={() => executeCommand('insertUnorderedList')}
            className="h-8 w-8 min-w-0 p-0 flex items-center justify-center rounded hover:bg-[hsla(var(--accent),0.15)] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] transition-all active:scale-95 cursor-pointer"
            title="Bulleted List"
          >
            <List size={15} />
          </button>
          <button
            type="button"
            onClick={() => executeCommand('insertOrderedList')}
            className="h-8 w-8 min-w-0 p-0 flex items-center justify-center rounded hover:bg-[hsla(var(--accent),0.15)] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] transition-all active:scale-95 cursor-pointer"
            title="Numbered List"
          >
            <ListOrdered size={15} />
          </button>
          <button
            type="button"
            onClick={() => executeCommand('justifyLeft')}
            className="h-8 w-8 min-w-0 p-0 flex items-center justify-center rounded hover:bg-[hsla(var(--accent),0.15)] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] transition-all active:scale-95 cursor-pointer"
            title="Align Left"
          >
            <AlignLeft size={15} />
          </button>
          <button
            type="button"
            onClick={() => executeCommand('justifyCenter')}
            className="h-8 w-8 min-w-0 p-0 flex items-center justify-center rounded hover:bg-[hsla(var(--accent),0.15)] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] transition-all active:scale-95 cursor-pointer"
            title="Align Center"
          >
            <AlignCenter size={15} />
          </button>
          <button
            type="button"
            onClick={() => executeCommand('justifyRight')}
            className="h-8 w-8 min-w-0 p-0 flex items-center justify-center rounded hover:bg-[hsla(var(--accent),0.15)] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] transition-all active:scale-95 cursor-pointer"
            title="Align Right"
          >
            <AlignRight size={15} />
          </button>
        </div>

        {/* Media Attachments group */}
        <div className="flex items-center gap-0.5 rounded-lg skeuo-well p-1 border border-[hsl(var(--border-subtle))]/10 shrink-0">
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            disabled={uploadingImage}
            className="h-8 px-2 flex items-center justify-center gap-1.5 rounded hover:bg-[hsla(var(--accent),0.15)] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] transition-all active:scale-95 disabled:opacity-50 cursor-pointer text-[10px] font-bold uppercase tracking-wider"
            title="Insert Image Attachment"
          >
            {uploadingImage ? <Loader2 size={14} className="animate-spin text-[hsl(var(--accent))]" /> : <ImageIcon size={14} />}
            Image
          </button>
        </div>

        {/* Clear and templates */}
        <div className="flex items-center gap-1.5 ml-auto">
          {/* Templates Trigger */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowTemplates(!showTemplates)}
              className="h-8 px-2.5 rounded-lg bg-[hsla(var(--accent),0.1)] border border-[hsl(var(--accent))]/30 flex items-center gap-1.5 text-[10px] font-bold text-[hsl(var(--text-primary))] uppercase tracking-wider hover:bg-[hsla(var(--accent),0.2)] transition-all cursor-pointer"
              title="Templates Library"
            >
              <Sparkles size={13} className="text-[hsl(var(--accent))]" />
              Templates
            </button>

            {showTemplates && (
              <div className="absolute right-0 mt-1.5 w-64 rounded-xl skeuo-panel p-2 shadow-2xl z-50 animate-slide-up-fade border border-[hsl(var(--border-subtle))]/50">
                <p className="text-[9px] font-extrabold text-[hsl(var(--text-muted))] uppercase tracking-widest px-2.5 py-1.5 border-b border-[hsl(var(--border-subtle))]/20">Inject Workspace Template</p>
                <div className="mt-1 space-y-0.5">
                  {TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.name}
                      type="button"
                      onClick={() => handleInjectTemplate(tpl.html)}
                      className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-[hsla(var(--accent),0.1)] transition-all flex flex-col cursor-pointer"
                    >
                      <span className="text-xs font-bold text-[hsl(var(--text-primary))]">{tpl.name}</span>
                      <span className="text-[10px] text-[hsl(var(--text-muted))] mt-0.5">{tpl.description}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleClearAll}
            className="h-8 w-8 min-w-0 p-0 flex items-center justify-center rounded-lg skeuo-well hover:bg-[hsl(var(--danger))]/10 border border-[hsl(var(--border-subtle))]/10 text-[hsl(var(--text-muted))] hover:text-[hsl(var(--danger))] transition-all cursor-pointer"
            title="Reset/Clear Document Draft"
          >
            <Eraser size={14} />
          </button>
        </div>
      </div>

      {/* Sunken Document Recess and White/Carbon Sheet Canvas */}
      <div className="skeuo-well p-4 border border-[hsl(var(--border-subtle))]/20 shadow-[inset_0_4px_8px_rgba(0,0,0,0.3)] bg-gradient-to-b from-black/20 to-black/5 flex justify-center">
        <div className="w-full max-w-2xl bg-white dark:bg-[#12151d] text-slate-800 dark:text-slate-100 rounded-xl shadow-2xl p-6 md:p-8 min-h-[300px] border border-white/80 dark:border-white/10 transition-colors relative flex flex-col">
          {/* Custom style for inner placeholder support */}
          {!value && (
            <div className="absolute top-6 md:top-8 left-6 md:left-8 right-6 md:right-8 text-sm text-slate-400 dark:text-slate-500 pointer-events-none select-none font-sans italic leading-relaxed">
              {placeholder}
            </div>
          )}

          {/* Editable Document Layer */}
          <div
            ref={editorRef}
            contentEditable
            onInput={handleInput}
            onPaste={handlePaste}
            className="flex-1 outline-none text-sm leading-relaxed font-sans min-h-[250px] overflow-y-auto prose dark:prose-invert prose-slate max-w-none focus:outline-none"
            style={{
              caretColor: 'hsl(var(--accent))',
              wordBreak: 'break-word',
            }}
          />
        </div>
      </div>

      {/* Editor Stats Footer (Word and Character Count) */}
      <div className="flex items-center justify-between p-2.5 px-4 text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--text-muted))] border-t border-[hsl(var(--border-subtle))]/20 bg-[hsl(var(--bg-sidebar))]/30">
        <div className="flex items-center gap-4">
          <span>Words: <span className="text-[hsl(var(--text-primary))]">{wordCount}</span></span>
          <span>Chars: <span className="text-[hsl(var(--text-primary))]">{charCount}</span></span>
        </div>
        <div className="flex items-center gap-2">
          {uploadingImage && (
            <span className="flex items-center gap-1 text-[hsl(var(--accent))] animate-pulse">
              <Loader2 size={10} className="animate-spin" />
              Uploading Media...
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <RefreshCw size={10} className="text-[hsl(var(--success))] animate-pulse" />
            <span className="text-[hsl(var(--success))]">Auto-Saving Sync</span>
          </span>
        </div>
      </div>
    </div>
  );
}
