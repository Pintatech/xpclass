import React from 'react'

// Rich Text Renderer Component for Multiple Choice Questions
// Supports HTML formatting: bold, italic, underline, images, etc.

const RichTextRenderer = ({
  content,
  className = '',
  allowImages = true,
  allowLinks = false,
  style = {}
}) => {
  if (!content || typeof content !== 'string') {
    return <span className={className}>{content}</span>
  }

  // Check if content contains HTML tags
  const hasHTMLTags = /<[^>]*>/g.test(content)

  if (!hasHTMLTags) {
    // Plain text - convert line breaks to <br> tags
    const contentWithBreaks = content.replace(/\n/g, '<br>')
    return (
      <div
        className={className}
        dangerouslySetInnerHTML={{ __html: contentWithBreaks }}
        style={{
          wordBreak: 'break-word',
          lineHeight: '1.6',
          color: 'inherit',
          ...style
        }}
      />
    )
  }

  // Convert markdown to HTML first
  const markdownToHtml = (text) => {
    if (!text) return ''
    let html = text

    // Images: ![alt](url) - must come before links
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />')

    // Links: [text](url)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')

    // Bold: **text** or __text__ - must come before italic
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>')

    // Italic: *text* (single asterisk, not double)
    // Use a more careful approach to avoid matching ** markers
    html = html.replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, '<em>$1</em>')

    // Strikethrough: ~~text~~
    html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>')

    return html
  }

  // Sanitize and process HTML content
  const sanitizeHTML = (html) => {
    // First convert any markdown syntax to HTML
    let processedHtml = markdownToHtml(html)

    // Convert line breaks to <br> tags (simpler approach)
    processedHtml = processedHtml.replace(/\n/g, '<br>')

    // Basic sanitization - remove dangerous attributes and scripts
    let sanitized = processedHtml
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/vbscript:/gi, '')

    // Process images if allowed
    if (allowImages) {
      // Ensure images have proper attributes and styling
      sanitized = sanitized.replace(
        /<img([^>]*)>/gi,
        (match, attrs) => {
          // Preserve existing styles and add our defaults
          if (attrs.includes('style=')) {
            return `<img${attrs} class="rounded-lg" loading="lazy" />`
          }
          return `<img${attrs} style="max-width: 100%; height: auto; display: inline-block;" class="rounded-lg" loading="lazy" />`
        }
      )
    }

    return sanitized
  }

  const processedContent = sanitizeHTML(content)

  return (
    <div
      className={`rich-text-content ${className}`}
      dangerouslySetInnerHTML={{ __html: processedContent }}
      style={{
        wordBreak: 'break-word',
        overflowWrap: 'anywhere',
        lineHeight: '1.6',
        color: 'inherit',
        ...style
      }}
    />
  )
}

// Helper function to create formatted text examples
export const createFormattedText = {
  bold: (text) => `<strong>${text}</strong>`,
  italic: (text) => `<em>${text}</em>`,
  underline: (text) => `<u>${text}</u>`,
  highlight: (text) => `<mark>${text}</mark>`,
  code: (text) => `<code class="bg-gray-100 px-1 rounded">${text}</code>`,

  // Combination formatting
  boldItalic: (text) => `<strong><em>${text}</em></strong>`,
  boldUnderline: (text) => `<strong><u>${text}</u></strong>`,

  // With image
  withImage: (text, imageUrl, altText = '') =>
    `${text}<br><img src="${imageUrl}" alt="${altText}" class="max-w-sm mx-auto block my-4" />`,

  // Fill in the blank style
  fillBlank: (beforeText, afterText) =>
    `${beforeText} <u style="min-width: 100px; display: inline-block; border-bottom: 2px solid #333;">______</u> ${afterText}`,

  // Line breaks (newlines will be automatically converted)
  multiLine: (text) => text, // Just use normal line breaks in your text
  withLineBreaks: (line1, line2, line3) => `${line1}\n${line2}\n${line3}`,

  // Manual line breaks using HTML
  manualBreaks: (line1, line2) => `${line1}<br>${line2}`,

  // Multiple choice with formatting
  styledOption: (text, style = 'normal') => {
    const styles = {
      correct: `<span class="text-green-700 font-semibold">${text}</span>`,
      incorrect: `<span class="text-red-600">${text}</span>`,
      highlight: `<mark class="bg-yellow-200">${text}</mark>`,
      code: `<code class="bg-gray-100 px-2 py-1 rounded font-mono">${text}</code>`,
      normal: text
    }
    return styles[style] || text
  }
}

export default RichTextRenderer