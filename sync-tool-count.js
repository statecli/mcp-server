const fs = require('fs');
let content = fs.readFileSync('docs/index.html', 'utf-8');

// Update the tool section header
content = content.replace(
  '<h2 class="text-2xl sm:text-3xl font-bold mb-8 text-center">27 Tools for AI Agents</h2>',
  '<h2 class="text-2xl sm:text-3xl font-bold mb-8 text-center">31 Tools for AI Agents</h2>'
);

// Update the tool grid to include the remaining 12 tools
const oldGrid = /<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">[\s\S]*?<\/div>[\s\S]*?<\/div>/;
const newGrid = `<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
            <div class="bg-gray-800 p-4 rounded-lg">
                <h3 class="font-semibold text-purple-400 mb-2">Core</h3>
                <ul class="text-sm text-gray-300 space-y-1">
                    <li>• statecli_track</li>
                    <li>• statecli_replay</li>
                    <li>• statecli_undo</li>
                    <li>• statecli_checkpoint</li>
                    <li>• statecli_log</li>
                </ul>
            </div>
            <div class="bg-gray-800 p-4 rounded-lg">
                <h3 class="font-semibold text-blue-400 mb-2">File Tracking</h3>
                <ul class="text-sm text-gray-300 space-y-1">
                    <li>• statecli_track_file</li>
                    <li>• statecli_file_history</li>
                </ul>
            </div>
            <div class="bg-gray-800 p-4 rounded-lg">
                <h3 class="font-semibold text-red-400 mb-2">Error Recovery</h3>
                <ul class="text-sm text-gray-300 space-y-1">
                    <li>• statecli_analyze_error</li>
                    <li>• statecli_auto_recover</li>
                    <li>• statecli_safe_execute</li>
                </ul>
            </div>
            <div class="bg-gray-800 p-4 rounded-lg">
                <h3 class="font-semibold text-green-400 mb-2">Test Awareness</h3>
                <ul class="text-sm text-gray-300 space-y-1">
                    <li>• statecli_run_tests</li>
                    <li>• statecli_test_impact</li>
                    <li>• statecli_suggest_tests</li>
                </ul>
            </div>
            <div class="bg-gray-800 p-4 rounded-lg">
                <h3 class="font-semibold text-yellow-400 mb-2">Dependencies</h3>
                <ul class="text-sm text-gray-300 space-y-1">
                    <li>• statecli_analyze_dependencies</li>
                    <li>• statecli_dependency_tree</li>
                    <li>• statecli_find_circular</li>
                </ul>
            </div>
            <div class="bg-gray-800 p-4 rounded-lg">
                <h3 class="font-semibold text-pink-400 mb-2">Impact Analysis</h3>
                <ul class="text-sm text-gray-300 space-y-1">
                    <li>• statecli_predict_impact</li>
                    <li>• statecli_is_safe</li>
                    <li>• statecli_preview_undo</li>
                    <li>• statecli_simulate_undo</li>
                    <li>• statecli_safe_change_order</li>
                </ul>
            </div>
            <div class="bg-gray-800 p-4 rounded-lg">
                <h3 class="font-semibold text-indigo-400 mb-2">Knowledge</h3>
                <ul class="text-sm text-gray-300 space-y-1">
                    <li>• statecli_search_web</li>
                    <li>• statecli_read_url</li>
                </ul>
            </div>
            <div class="bg-gray-800 p-4 rounded-lg">
                <h3 class="font-semibold text-cyan-400 mb-2">Memory</h3>
                <ul class="text-sm text-gray-300 space-y-1">
                    <li>• statecli_memory_query</li>
                    <li>• statecli_recent_activity</li>
                    <li>• statecli_session_info</li>
                </ul>
            </div>
            <div class="bg-gray-800 p-4 rounded-lg">
                <h3 class="font-semibold text-orange-400 mb-2">Git Integration</h3>
                <ul class="text-sm text-gray-300 space-y-1">
                    <li>• statecli_git_status</li>
                    <li>• statecli_git_history</li>
                    <li>• statecli_git_checkpoint</li>
                </ul>
            </div>
            <div class="bg-gray-800 p-4 rounded-lg">
                <h3 class="font-semibold text-emerald-400 mb-2">Multi-Agent</h3>
                <ul class="text-sm text-gray-300 space-y-1">
                    <li>• statecli_join_session</li>
                    <li>• statecli_leave_session</li>
                </ul>
            </div>
        </div>`;
content = content.replace(oldGrid, newGrid);

fs.writeFileSync('docs/index.html', content);
console.log("Successfully updated docs/index.html with 31 tools");
