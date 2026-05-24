import {
  BackspaceIcon,
  ChatBubbleBottomCenterTextIcon,
  LinkIcon,
  ListBulletIcon,
  QueueListIcon,
} from '@heroicons/react/24/outline'
import Modal from './Modal'
import { useRichTextEditor } from '../hooks/useRichTextEditor'

const toolbarButtons = [
  { key: 'bold', label: 'B', title: 'Bold', command: 'bold' },
  { key: 'italic', label: 'I', title: 'Italic', command: 'italic' },
  { key: 'underline', label: 'U', title: 'Underline', command: 'underline' },
  { key: 'heading', label: 'H2', title: 'Heading', command: 'formatBlock', value: 'h2' },
  {
    key: 'unordered',
    label: 'Bullets',
    title: 'Bulleted list',
    command: 'insertUnorderedList',
    Icon: ListBulletIcon,
  },
  {
    key: 'ordered',
    label: 'Numbered list',
    title: 'Numbered list',
    command: 'insertOrderedList',
    Icon: QueueListIcon,
  },
  {
    key: 'quote',
    label: 'Quote',
    title: 'Quote block',
    command: 'formatBlock',
    value: 'blockquote',
    Icon: ChatBubbleBottomCenterTextIcon,
  },
  {
    key: 'clear',
    label: 'Clear',
    title: 'Clear formatting',
    command: 'removeFormat',
    Icon: BackspaceIcon,
  },
]

function RichTextEditor({ value, onChange, placeholder, disabled = false, hideToolbar = false, minHeightClass = 'min-h-[120px]' }) {
  const {
    editorRef,
    isLinkModalOpen,
    linkValue,
    setLinkValue,
    linkError,
    emitChange,
    executeCommand,
    handleCreateLink,
    closeLinkModal,
    submitLink
  } = useRichTextEditor({ value, onChange, disabled })

  return (
    <div className="rounded-2xl border border-[#2f3336] bg-black overflow-hidden focus-within:border-[#1d9bf0] transition">
      {/* Editor Content Area */}
      <div
        ref={editorRef}
        contentEditable={!disabled}
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={emitChange}
        className={`rich-editor px-4 py-3 text-[#e7e9ea] focus:outline-none text-lg leading-relaxed ${minHeightClass} ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      />

      {/* Toolbar Area */}
      {!hideToolbar && (
        <div className="flex flex-wrap items-center gap-1 border-t border-[#2f3336] px-3 py-2 bg-[#09090b]">
        {toolbarButtons.map((button) => {
          const Icon = button.Icon

          return (
            <button
              key={button.key}
              type="button"
              title={button.title || button.label}
              aria-label={button.title || button.label}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => executeCommand(button.command, button.value)}
              disabled={disabled}
              className="inline-flex items-center justify-center p-2 text-xs font-semibold text-[#71767b] hover:text-[#1d9bf0] hover:bg-[#1d9bf0]/10 rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {Icon ? <Icon className="w-4 h-4" aria-hidden="true" /> : <span className="font-bold px-1">{button.label}</span>}
            </button>
          )
        })}
        <button
          type="button"
          title="Insert link"
          aria-label="Insert link"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleCreateLink}
          disabled={disabled}
          className="inline-flex items-center justify-center p-2 text-xs font-semibold text-[#71767b] hover:text-[#1d9bf0] hover:bg-[#1d9bf0]/10 rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          <LinkIcon className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
      )}

      <Modal
        isOpen={isLinkModalOpen}
        title="Insert Link"
        onClose={closeLinkModal}
        actions={(
          <>
            <button
              type="button"
              onClick={closeLinkModal}
              className="rounded-full border border-[#2f3336] px-4 py-2 text-sm font-bold text-[#e7e9ea] hover:bg-[#16181c]"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="insert-link-form"
              className="rounded-full bg-[#1d9bf0] px-4 py-2 text-sm font-bold text-white hover:bg-[#1a8cd8]"
            >
              Insert
            </button>
          </>
        )}
      >
        <form id="insert-link-form" onSubmit={submitLink} className="space-y-4">
          <label htmlFor="editor-link-input" className="block text-sm font-medium text-[#71767b]">
            Link URL
          </label>
          <input
            id="editor-link-input"
            type="text"
            value={linkValue}
            onChange={(event) => setLinkValue(event.target.value)}
            placeholder="https://example.com"
            className="w-full bg-black rounded-lg border border-[#2f3336] px-3 py-2 text-sm text-white focus:border-[#1d9bf0] focus:outline-none focus:ring-1 focus:ring-[#1d9bf0]"
            autoFocus
          />
          {linkError && <p className="mt-2 text-xs text-[#f4212e]">{linkError}</p>}
        </form>
      </Modal>
    </div>
  )
}

export default RichTextEditor
