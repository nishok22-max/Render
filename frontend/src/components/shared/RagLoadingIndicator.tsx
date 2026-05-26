/**
 * ThinkSync OS â€” RAG Loading Indicator
 * Animated three-dot loading indicator for RAG retrieval states.
 *
 * Displayed ONLY when RAG retrieval is actively processing:
 *   - Document retrieval in progress
 *   - Vector database search running
 *   - Chunk retrieval being processed
 *   - Semantic knowledge lookup underway
 *
 * NEVER shown for: AI Chat, Coding, Vision, Voice, Analytics, or General orchestration.
 */
import { motion, AnimatePresence } from 'motion/react';
import { Database } from 'lucide-react';

// â”€â”€â”€ Color tokens â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const TOKENS = {
  iconBorder:   '#b8860b',
  iconFill:     '#d4a017',
  dotColor:     '#b8860b',
  background:   '#0d0d0d',
  containerRadius: 12,
} as const;

// â”€â”€â”€ Animation spec â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const DOT_SIZE     = 7;
const DOT_DELAYS   = [0, 0.25, 0.5];    // stagger left â†’ right
const ANIM_DURATION = 1.4;               // seconds, ease-in-out infinite

interface RagLoadingIndicatorProps {
  /** Whether the RAG retrieval pipeline is actively running */
  isRetrieving: boolean;
  /** Optional status label override */
  label?: string;
  /** Optional additional class names */
  className?: string;
}

export const RagLoadingIndicator = ({
  isRetrieving,
  label = 'RAG retrieving...',
  className = '',
}: RagLoadingIndicatorProps) => (
  <AnimatePresence>
    {isRetrieving && (
      <motion.div
        initial={{ opacity: 0, y: -8, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.95 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className={`inline-flex items-center gap-3 ${className}`}
        style={{
          background: TOKENS.background,
          borderRadius: TOKENS.containerRadius,
          padding: '10px 18px 10px 12px',
        }}
      >
        {/* â”€â”€ Database icon container â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'rgba(184, 134, 11, 0.08)',
            border: `1.5px solid ${TOKENS.iconBorder}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Database
            style={{ width: 16, height: 16, color: TOKENS.iconFill }}
          />
        </div>

        {/* â”€â”€ Three-dot pulse animation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {DOT_DELAYS.map((delay, i) => (
            <motion.span
              key={i}
              animate={{
                opacity: [0.3, 1, 0.3],
                scale:   [1, 1.2, 1],
              }}
              transition={{
                duration: ANIM_DURATION,
                ease: 'easeInOut',
                repeat: Infinity,
                delay,
              }}
              style={{
                width:  DOT_SIZE,
                height: DOT_SIZE,
                borderRadius: '50%',
                backgroundColor: TOKENS.dotColor,
                display: 'block',
              }}
            />
          ))}
        </div>

        {/* â”€â”€ Label â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <span
          style={{
            fontSize: 10,
            fontWeight: 500,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'rgba(255, 255, 255, 0.30)',
            marginLeft: 2,
            whiteSpace: 'nowrap',
            userSelect: 'none',
          }}
        >
          {label}
        </span>
      </motion.div>
    )}
  </AnimatePresence>
);

export default RagLoadingIndicator;
