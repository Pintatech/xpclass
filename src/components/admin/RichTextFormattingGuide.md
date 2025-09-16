# Rich Text Formatting Guide for Multiple Choice Questions

## Overview
Multiple choice questions now support HTML formatting for questions, options, and explanations. This allows you to create more engaging and visually appealing content.

## Basic Formatting

### Text Styling
```html
<strong>Bold text</strong>
<em>Italic text</em>
<u>Underlined text</u>
<mark>Highlighted text</mark>
```

### Combinations
```html
<strong><em>Bold and italic</em></strong>
<strong><u>Bold and underlined</u></strong>
```

## Advanced Formatting

### Code and Technical Terms
```html
<code>variable_name</code>
<pre>code block</pre>
```

### Lists
```html
<ul>
  <li>First item</li>
  <li>Second item</li>
</ul>

<ol>
  <li>Step one</li>
  <li>Step two</li>
</ol>
```

### Headers
```html
<h3>Section Title</h3>
<h4>Subsection</h4>
```

### Line Breaks

#### Automatic Line Breaks (Easiest Way)
Just press **Enter** in the text area:
```
This is line one
This is line two
This is line three
```

#### Manual HTML Line Breaks
```html
This is line one<br>
This is line two<br>
This is line three
```

#### Paragraphs
```html
<p>This is the first paragraph.</p>
<p>This is the second paragraph.</p>
```

## Images

### Adding Images to Questions
```html
What animal is shown in this image?
<img src="https://example.com/dog.jpg" alt="A friendly dog" />
```

### Images in Options
```html
<img src="https://example.com/cat.jpg" alt="Cat" style="width: 100px;" /> Cat
```

## Examples

### Fill-in-the-Blank Style
```html
Complete the sentence: "The <u>_____</u> is the largest planet in our solar system."
```

### Math/Science Questions
```html
What is the result of <strong>2 + 2</strong>?
Options:
- <code>3</code>
- <code>4</code> ✓
- <code>5</code>
- <code>6</code>
```

### Language Learning
```html
How do you say <em>"Hello"</em> in <strong>Vietnamese</strong>?
Options:
- <mark>Xin chào</mark> ✓
- Tạm biệt
- Cảm ơn
- Xin lỗi
```

### Multi-Line Questions
```
Read the following passage:

"The quick brown fox jumps over the lazy dog."

What does this sentence demonstrate?
```

### Step-by-Step Instructions
```
Follow these steps:

1. Open the application
2. Click on Settings
3. Select Language

Which menu item comes next?
```

### Visual Questions
```html
Which flag belongs to Vietnam?
<br>
A) <img src="/flags/usa.png" alt="USA flag" style="width: 60px;" />
B) <img src="/flags/vietnam.png" alt="Vietnam flag" style="width: 60px;" /> ✓
C) <img src="/flags/china.png" alt="China flag" style="width: 60px;" />
```

## Best Practices

1. **Keep it Simple**: Don't overuse formatting - use it to highlight important information
2. **Accessibility**: Always include `alt` text for images
3. **Consistency**: Use consistent styling throughout your questions
4. **Mobile-Friendly**: Test how your formatted content looks on mobile devices
5. **Size Limits**: Keep images reasonably sized (under 200KB recommended)

## Safety Notes

- Only safe HTML tags are allowed (no JavaScript or dangerous content)
- Images are automatically made responsive
- External links are disabled by default for security

## Testing Your Formatting

After creating questions with formatting:
1. Preview them in the exercise editor
2. Test the actual multiple choice exercise
3. Check on both desktop and mobile views
4. Verify images load properly