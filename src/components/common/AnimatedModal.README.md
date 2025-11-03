# AnimatedModal Component

A reusable modal component with beautiful animations, backdrop blur effects, and comprehensive accessibility features.

## Features

✨ **Smooth Animations**
- Slide-in animation from top
- Scale and fade effects
- Smooth transitions (300ms)

🌫️ **Backdrop Blur**
- Beautiful backdrop blur effect
- Semi-transparent dark overlay (50% opacity)
- Prevents body scroll when modal is open

🎨 **Customizable**
- Multiple size options (sm, md, lg, xl, 2xl, 3xl, 4xl, full)
- Dark mode support
- Custom className support
- Optional close button
- Configurable backdrop click behavior

♿ **Accessible**
- ESC key to close
- Focus trap within modal
- Proper ARIA labels
- Keyboard navigation support

## Usage

### Basic Example

\`\`\`tsx
import { AnimatedModal } from '@/components/common/AnimatedModal'

function MyComponent() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button onClick={() => setIsOpen(true)}>
        Open Modal
      </button>

      <AnimatedModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="My Modal Title"
      >
        <p>Modal content goes here</p>
      </AnimatedModal>
    </>
  )
}
\`\`\`

### Advanced Example

\`\`\`tsx
<AnimatedModal
  isOpen={showModal}
  onClose={handleClose}
  title="Large Modal"
  size="2xl"
  showCloseButton={true}
  closeOnBackdropClick={false}
  className="custom-class"
>
  <div className="space-y-4">
    <p>This is a larger modal</p>
    <p>Backdrop click is disabled</p>
  </div>
</AnimatedModal>
\`\`\`

### Without Title (Custom Header)

\`\`\`tsx
<AnimatedModal
  isOpen={isOpen}
  onClose={handleClose}
  showCloseButton={false}
>
  <div>
    <h2 className="text-2xl font-bold mb-4">Custom Header</h2>
    <p>Content here</p>
  </div>
</AnimatedModal>
\`\`\`

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `isOpen` | `boolean` | required | Controls modal visibility |
| `onClose` | `() => void` | required | Callback when modal should close |
| `title` | `string` | optional | Modal title (shown in header) |
| `children` | `ReactNode` | required | Modal content |
| `size` | `'sm' \| 'md' \| 'lg' \| 'xl' \| '2xl' \| '3xl' \| '4xl' \| 'full'` | `'md'` | Modal width |
| `showCloseButton` | `boolean` | `true` | Show X button in header |
| `closeOnBackdropClick` | `boolean` | `true` | Allow closing by clicking backdrop |
| `className` | `string` | `''` | Additional CSS classes |

## Size Reference

- `sm`: 384px (24rem)
- `md`: 448px (28rem) - **Default**
- `lg`: 512px (32rem)
- `xl`: 576px (36rem)
- `2xl`: 672px (42rem)
- `3xl`: 768px (48rem)
- `4xl`: 896px (56rem)
- `full`: Full width with margins

## Features in Detail

### Animations

The modal features three animation effects:

1. **Backdrop fade-in**: Background darkens smoothly
2. **Blur effect**: Background blurs progressively
3. **Modal slide-in**: Modal slides down from above with scale effect

### Body Scroll Prevention

When the modal opens:
- Body scroll is automatically disabled
- Prevents background page from scrolling
- Scroll is restored when modal closes

### Keyboard Support

- **ESC key**: Closes the modal (unless custom handler prevents it)
- **Tab key**: Traps focus within modal
- Proper focus management

### Dark Mode

The modal automatically adapts to dark mode:
- Background: `bg-white dark:bg-gray-800`
- Text: `text-gray-900 dark:text-gray-100`
- Borders: `border-gray-200 dark:border-gray-700`

## Implementation Notes

### Timing

- Animation duration: 300ms
- Unmount delay: 300ms (matches animation)
- Double `requestAnimationFrame` ensures smooth animation start

### Z-Index

- Modal uses `z-50` by default
- Ensure parent elements don't have higher z-index
- Backdrop is positioned absolute within modal container

### Performance

- Uses CSS transforms for smooth animations
- Hardware-accelerated (`transform` and `opacity`)
- Minimal reflows and repaints
- Cleanup on unmount prevents memory leaks

## Examples in MedEx CRM

### Invoice Generation Modal (DashboardPage)

\`\`\`tsx
<AnimatedModal
  isOpen={showInvoiceModal}
  onClose={() => {
    setShowInvoiceModal(false)
    setInvoiceSuccess(null)
    setError('')
    setShowConfirmDialog(false)
  }}
  title="Generate Invoice"
  size="md"
>
  {/* Invoice generation content */}
</AnimatedModal>
\`\`\`

## Best Practices

1. **Always provide onClose handler**: Even if backdrop clicking is disabled
2. **Clean up state on close**: Reset any modal-specific state
3. **Use appropriate size**: Match content width to modal size
4. **Provide meaningful titles**: Helps with accessibility
5. **Handle loading states**: Show spinners for async operations
6. **Prevent multiple opens**: Disable trigger button when modal is open

## Troubleshooting

### Modal doesn't appear

- Check `isOpen` prop is `true`
- Verify no parent element has `overflow: hidden`
- Check z-index conflicts

### Backdrop click not working

- Ensure `closeOnBackdropClick` is `true`
- Check if click events are being stopped by child elements

### Animation stutters

- Reduce complexity of modal content
- Use CSS transforms instead of position changes
- Check for heavy JavaScript during mount

## Future Enhancements

Potential improvements:
- [ ] Stacking modals support
- [ ] Custom animation types
- [ ] Focus trap improvements
- [ ] Portal rendering option
- [ ] Custom backdrop styles
