import { useEffect, useRef, useState } from 'react'

const placeCaretAtEnd = (element) => {
  const range = document.createRange()
  range.selectNodeContents(element)
  range.collapse(false)

  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}

const hasSelectionInsideEditor = (editor) => {
  const selection = window.getSelection()

  if (!selection || selection.rangeCount === 0) {
    return false
  }

  const range = selection.getRangeAt(0)
  return editor.contains(range.commonAncestorContainer)
}

const getSelectionContainerElement = (editor) => {
  const selection = window.getSelection()

  if (!selection || selection.rangeCount === 0) {
    return null
  }

  const node = selection.getRangeAt(0).commonAncestorContainer
  const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement

  if (!element || !editor.contains(element)) {
    return null
  }

  return element
}

const applyFormatBlock = (tagName = 'p') => {
  const normalizedTag = String(tagName).toLowerCase()
  const wrappedTag = `<${normalizedTag}>`
  const applied = document.execCommand('formatBlock', false, wrappedTag)

  if (!applied) {
    document.execCommand('formatBlock', false, normalizedTag.toUpperCase())
  }
}

const clearCurrentFormatting = (editor) => {
  const selectionContainer = getSelectionContainerElement(editor)
  const listElement = selectionContainer?.closest('ul,ol')

  if (listElement?.tagName === 'UL') {
    document.execCommand('insertUnorderedList', false, null)
  }

  if (listElement?.tagName === 'OL') {
    document.execCommand('insertOrderedList', false, null)
  }

  if (selectionContainer?.closest('blockquote')) {
    document.execCommand('outdent', false, null)
  }

  applyFormatBlock('p')
  document.execCommand('unlink', false, null)
  document.execCommand('removeFormat', false, null)
}

export function useRichTextEditor({ value, onChange, disabled }) {
  const editorRef = useRef(null)
  const selectionBeforeDialogRef = useRef(null)
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false)
  const [linkValue, setLinkValue] = useState('')
  const [linkError, setLinkError] = useState('')

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || ''
    }
  }, [value])

  const emitChange = () => {
    if (!editorRef.current) {
      return
    }

    onChange(editorRef.current.innerHTML)
  }

  const executeCommand = (command, commandValue = null) => {
    if (disabled || !editorRef.current) {
      return
    }

    editorRef.current.focus()
    if (!hasSelectionInsideEditor(editorRef.current)) {
      placeCaretAtEnd(editorRef.current)
    }

    if (command === 'formatBlock') {
      applyFormatBlock(commandValue || 'p')
    } else if (command === 'removeFormat') {
      clearCurrentFormatting(editorRef.current)
    } else {
      document.execCommand(command, false, commandValue)
    }

    emitChange()
  }

  const captureSelection = () => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0 || !editorRef.current) {
      selectionBeforeDialogRef.current = null
      return
    }

    const range = selection.getRangeAt(0)
    if (!editorRef.current.contains(range.commonAncestorContainer)) {
      selectionBeforeDialogRef.current = null
      return
    }

    selectionBeforeDialogRef.current = range.cloneRange()
  }

  const restoreSelection = () => {
    if (!selectionBeforeDialogRef.current) {
      return
    }

    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(selectionBeforeDialogRef.current)
  }

  const handleCreateLink = () => {
    if (disabled) {
      return
    }

    captureSelection()
    setLinkValue('')
    setLinkError('')
    setIsLinkModalOpen(true)
  }

  const closeLinkModal = () => {
    setIsLinkModalOpen(false)
    setLinkError('')
  }

  const submitLink = (e) => {
    e.preventDefault()

    const trimmedUrl = linkValue.trim()
    if (!trimmedUrl) {
      setLinkError('Please enter a link URL')
      return
    }

    const normalizedUrl = /^https?:\/\//i.test(trimmedUrl)
      ? trimmedUrl
      : `https://${trimmedUrl}`

    setIsLinkModalOpen(false)
    editorRef.current?.focus()
    restoreSelection()
    setLinkValue('')
    setLinkError('')

    executeCommand('createLink', normalizedUrl)
  }

  return {
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
  }
}
