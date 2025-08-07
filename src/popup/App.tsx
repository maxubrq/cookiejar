import Logo from '@/components/Logo';
import { motion } from 'motion/react';
import './App.css';

export default function App() {
  return (
    <motion.div className='w-full overflow-x-hidden flex flex-col items-center justify-center text-center'>
      <Logo />
      <div>
        <h1>cookiejar</h1>
        <p>Welcome to the cookiejar extension!</p>
        <p><strong>CookieJar is used to sync your cookies across devices.</strong></p>
      </div>
    </motion.div>
  )
}
