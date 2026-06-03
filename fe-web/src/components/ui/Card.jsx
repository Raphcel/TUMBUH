import { motion } from 'framer-motion';

export function Card({ className = '', children, ...props }) {
  return (
    <motion.div
      className={`bg-white rounded-xl border border-[#E6ECF5] shadow-sm overflow-hidden ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function CardHeader({ className = '', children }) {
  return <div className={`px-6 py-4 border-b border-[#E6ECF5] ${className}`}>{children}</div>;
}

export function CardBody({ className = '', children }) {
  return <div className={`p-6 ${className}`}>{children}</div>;
}

export function CardFooter({ className = '', children }) {
  return <div className={`px-6 py-4 bg-[#E6ECF5] border-t border-[#E6ECF5] ${className}`}>{children}</div>;
}
