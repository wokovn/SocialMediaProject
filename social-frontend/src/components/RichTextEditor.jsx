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



function RichTextEditor({ value, onChange, placeholder, disabled = false }) {
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
    <div className="rounded-lg border border-gray-300 bg-white overflow-hidden">
      <div className="flex flex-wrap items-center gap-1 border-b border-gray-200 px-2 py-2 bg-gray-50">
        {toolbarButtons.map((button) => (
          (() => {
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
                className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {Icon ? <Icon className="w-4 h-4" aria-hidden="true" /> : button.label}
                {Icon ? <span className="hidden sm:inline">{button.label}</span> : null}
              </button>
            )
          })()
        ))}
        <button
          type="button"
          title="Insert link"
          aria-label="Insert link"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleCreateLink}
          disabled={disabled}
          className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          <LinkIcon className="w-4 h-4" aria-hidden="true" />
          <span className="hidden sm:inline">Link</span>
        </button>
      </div>

      <div
        ref={editorRef}
        contentEditable={!disabled}
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={emitChange}
        className={`rich-editor min-h-[140px] px-4 py-3 text-gray-800 focus:outline-none ${
          disabled ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''
        }`}
      />

      <Modal
        isOpen={isLinkModalOpen}
        title="Insert Link"
        onClose={closeLinkModal}
        actions={(
          <>
            <button
              type="button"
              onClick={closeLinkModal}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="insert-link-form"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Insert
            </button>
          </>
        )}
      >
        <form id="insert-link-form" onSubmit={submitLink}>
          <label htmlFor="editor-link-input" className="mb-2 block text-sm font-medium text-gray-700">
            Link URL
          </label>
          <input
            id="editor-link-input"
            type="text"
            value={linkValue}
            onChange={(event) => setLinkValue(event.target.value)}
            placeholder="https://example.com"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
          {linkError && <p className="mt-2 text-xs text-red-600">{linkError}</p>}
        </form>
      </Modal>
    </div>
  )
}

export default RichTextEditor
