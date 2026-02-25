const fs = require('fs');
let code = fs.readFileSync('src/components/StudyTimer.tsx', 'utf-8');

// The replacement logic:
// We want to replace everything from the first <AnimatePresence> down to its matching </AnimatePresence> tag at the end, 
// and only return the interior expanded <motion.div> block without the close button.

let startStr = `  return (
    <>
      <AnimatePresence mode="wait">
        {!isExpanded ? (`;

let expandedSection = `          <motion.div
            key="expanded-card"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 30,
              mass: 1
            }}
            className="h-full min-w-[300px] xl:flex-shrink-0"
          >
            <Card className="w-full shadow-lg h-full bg-card/80 backdrop-blur-2xl border-border/50 hover:shadow-primary/5 transition-all duration-300">
              <CardContent className="p-5 h-full flex flex-col justify-between">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Clock className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground">Pomodoro</h3>
                      <p className="text-xs font-medium text-foreground">
                        {pomodoroDuration}min session
                      </p>
                    </div>
                  </div>
                </div>

                {/* Timer Display */}`;

// Let's use string manipulation to carefully slice out the wrapper:

const firstPart = code.substring(0, code.indexOf(startStr) + 11); // keeps return ( <>
const timerDisplayIndex = code.indexOf(`{/* Timer Display */}`);
const controlsIndex = code.indexOf(`{/* Controls */}`);
const endOfCard = code.lastIndexOf(`</Card>`);

const endPart = code.substring(controlsIndex, endOfCard + 7);

let combined = firstPart + `\n` + expandedSection + `\n` + code.substring(timerDisplayIndex + 20, controlsIndex) + endPart + `\n          </motion.div>\n    </>\n  );\n}\n`;

fs.writeFileSync('src/components/StudyTimer.tsx', combined);
