import { useEffect } from 'react'

function Modal({
  isOpen,
  title,
  children,
  onClose,
  actions,
  closeOnBackdrop = true,
  panelClassName = 'max-w-md',
}) {
  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose?.()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  if (!isOpen) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        aria-label="Close modal backdrop"
        className="absolute inset-0 bg-black/45"
        onClick={() => {
          if (closeOnBackdrop) {
            onClose?.()
          }
        }}
      />

      <div className={`relative z-10 w-full ${panelClassName} rounded-xl border border-gray-200 bg-white shadow-2xl`}>
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <button
            type="button"
            onClick={() => onClose?.()}
            className="rounded-md px-2 py-1 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          >
            Close
          </button>
        </div>

        <div className="px-5 py-4">{children}</div>

        {actions && (
          <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-5 py-4">
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}

export default Modal
