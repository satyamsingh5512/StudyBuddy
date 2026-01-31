import { motion } from 'framer-motion';
import { AlertCircle, Clock, Construction } from 'lucide-react';
import Logo from './Logo';

export default function Maintenance() {
  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center p-4 z-50">
      <div className="max-w-md w-full text-center space-y-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center gap-6"
        >
          {/* Animated Icon Wrapper */}
          <div className="relative">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 rounded-full border-t-2 border-primary/20"
            />
            <div className="bg-primary/10 p-6 rounded-full ring-1 ring-primary/20 backdrop-blur-sm">
              <Construction className="w-12 h-12 text-primary" />
            </div>
          </div>

          <div className="space-y-4">
            <h1 className="text-3xl font-bold tracking-tight">
              Under Maintenance
            </h1>
            <p className="text-muted-foreground text-lg leading-relaxed">
              We're currently performing scheduled maintenance to improve your experience. We'll be back shortly!
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 w-full max-w-sm mt-8">
            <div className="bg-card/50 border rounded-lg p-4 flex flex-col items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium">Estimated Time</span>
              <span className="text-xs text-muted-foreground">~30 Minutes</span>
            </div>
            <div className="bg-card/50 border rounded-lg p-4 flex flex-col items-center gap-2">
              <AlertCircle className="w-5 h-5 text-green-500" />
              <span className="text-sm font-medium">Status</span>
              <span className="text-xs text-muted-foreground">Updating...</span>
            </div>
          </div>

          <div className="pt-8 flex flex-col items-center gap-4">
            <Logo className="w-auto h-8 opacity-50 grayscale hover:grayscale-0 transition-all duration-300" />
            <p className="text-xs text-muted-foreground">
              StudyBuddy &copy; {new Date().getFullYear()}
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
