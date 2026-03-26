const fs = require('fs');
let content = fs.readFileSync('docs/index.html', 'utf-8');

// 1. Stats Bar
const oldStats = /<!-- Stats Bar -->[\s\S]*?<!-- Quick Install -->/;
const newStats = `<!-- Stats Bar -->
    <div class="bg-gray-800 border-y border-gray-700 py-8">
        <div class="max-w-5xl mx-auto px-4 text-center">
            <div class="text-gray-400 text-sm sm:text-lg">
                <span class="font-bold text-white">31 Tools</span> · 
                <span class="font-bold text-white">MCP Native</span> · 
                <span class="font-bold text-white">Framework Agnostic</span> · 
                <span class="font-bold text-white">MIT License</span> · 
                <span class="font-bold text-white">30 Second Install</span>
            </div>
        </div>
    </div>

    <!-- Quick Install -->`;
content = content.replace(oldStats, newStats);

// 2. Problem Section + Difference Section
const oldWhy = /<!-- Why -->[\s\S]*?<!-- Tools -->/;
const newWhy = `<!-- Why -->
    <section id="why" class="bg-gray-800 py-16">
        <div class="max-w-4xl mx-auto px-4">
            <h2 class="text-2xl sm:text-3xl font-bold mb-8 text-center">The Problem</h2>
            <div class="grid sm:grid-cols-2 gap-6 sm:gap-8">
                <div class="bg-gray-900 p-6 rounded-lg">
                    <h3 class="text-xl font-semibold mb-2 text-red-400">❌ Agent modified files. Can't tell what changed.</h3>
                    <h3 class="text-xl font-semibold mb-2 mt-4 text-green-400">✅ statecli_replay(entity)</h3>
                </div>
                <div class="bg-gray-900 p-6 rounded-lg">
                    <h3 class="text-xl font-semibold mb-2 text-red-400">❌ Agent broke something. No way back.</h3>
                    <h3 class="text-xl font-semibold mb-2 mt-4 text-green-400">✅ statecli_undo(entity)</h3>
                </div>
                <div class="bg-gray-900 p-6 rounded-lg">
                    <h3 class="text-xl font-semibold mb-2 text-red-400">❌ Risky operation coming. No safety net.</h3>
                    <h3 class="text-xl font-semibold mb-2 mt-4 text-green-400">✅ statecli_checkpoint(entity)</h3>
                </div>
                <div class="bg-gray-900 p-6 rounded-lg">
                    <h3 class="text-xl font-semibold mb-2 text-red-400">❌ Will this change break other files?</h3>
                    <h3 class="text-xl font-semibold mb-2 mt-4 text-green-400">✅ statecli_predict_impact(file)</h3>
                </div>
            </div>
        </div>
    </section>

    <!-- The Difference -->
    <section class="max-w-4xl mx-auto px-4 py-16">
        <div class="text-center mb-12">
            <h2 class="text-3xl sm:text-4xl font-bold mb-4 text-center">The Difference</h2>
            <p class="text-gray-400 text-center">Other tools watch agents. StateCLI reverses them.</p>
        </div>
        <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
                <thead>
                    <tr class="border-b border-gray-800">
                        <th class="py-4 px-4 text-gray-500 font-medium">Feature</th>
                        <th class="py-4 px-4 text-gray-500 font-medium text-center">Observability Tools</th>
                        <th class="py-4 px-4 text-purple-400 font-bold text-center">StateCLI</th>
                    </tr>
                </thead>
                <tbody>
                    <tr class="border-b border-gray-800">
                        <td class="py-4 px-4">See what happened</td>
                        <td class="py-4 px-4 text-center">✅</td>
                        <td class="py-4 px-4 text-center font-bold">✅</td>
                    </tr>
                    <tr class="border-b border-gray-800">
                        <td class="py-4 px-4">Undo what happened</td>
                        <td class="py-4 px-4 text-center">❌</td>
                        <td class="py-4 px-4 text-center font-bold">✅</td>
                    </tr>
                    <tr class="border-b border-gray-800">
                        <td class="py-4 px-4">Works any framework</td>
                        <td class="py-4 px-4 text-center">❌</td>
                        <td class="py-4 px-4 text-center font-bold">✅</td>
                    </tr>
                    <tr class="border-b border-gray-800">
                        <td class="py-4 px-4">Free forever</td>
                        <td class="py-4 px-4 text-center">❌</td>
                        <td class="py-4 px-4 text-center font-bold">✅</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </section>

    <!-- Tools -->`;
content = content.replace(oldWhy, newWhy);

// 3. Footer
content = content.replace(
  "Built for the AI agent ecosystem",
  "Built for the industry. Not for the exit."
);

fs.writeFileSync('docs/index.html', content);
console.log("Successfully updated docs/index.html");
