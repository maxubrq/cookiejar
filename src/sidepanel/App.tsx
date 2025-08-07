import Logo from '@/components/Logo';
import { motion } from 'motion/react';

export default function App() {
  return (
    <motion.div className='w-screen h-screen overflow-x-hidden flex flex-col items-center justify-center text-center bg-[#fafafa] text-[#333]'>
      <motion.div className='mb-8'
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <Logo className='w-32 h-32' />
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}>
        <h1 className='mb-4'>CookieJar <em>®</em></h1>
        <p>Welcome to the cookiejar extension!</p>
        <p><strong>CookieJar is used to sync your cookies across devices.</strong></p>
      </motion.div>
    </motion.div>
  )
}
