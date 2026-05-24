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
      {/* Backdrop overlay with blur */}
      <button
        type="button"
        aria-label="Close modal backdrop"
        className="absolute inset-0 bg-[#5b7083]/40 backdrop-blur-[2px]"
        onClick={() => {
          if (closeOnBackdrop) {
            onClose?.()
          }
        }}
      />

      {/* Modal box */}
      <div className={`relative z-10 w-full ${panelClassName} rounded-2xl border border-[#2f3336] bg-black shadow-2xl overflow-hidden`}>
        <div className="flex items-center justify-between border-b border-[#2f3336] px-5 py-4">
          <h3 className="text-base font-bold font-display text-white">{title}</h3>
          <button
            type="button"
            onClick={() => onClose?.()}
            className="rounded-full px-3 py-1.5 text-sm font-bold text-[#71767b] hover:bg-[#16181c] hover:text-white transition"
          >
            Close
          </button>
        </div>

        <div className="px-5 py-4 text-[#e7e9ea]">{children}</div>

        {actions && (
          <div className="flex items-center justify-end gap-2 border-t border-[#2f3336] px-5 py-4">
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}

export default Modal
