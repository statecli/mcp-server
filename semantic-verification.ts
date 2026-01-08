
import { SemanticMemory } from './src/semantic-memory';
import { StateCLI } from './src/statecli';
import * as path from 'path';

async function verifySemanticSearch() {
    console.log('Initializing Semantic Memory Verification...');

    const memoryDir = path.join(process.cwd(), '.statecli', 'semantic-verify');
    const statecli = new StateCLI(); // Dummy instance
    const semantic = new SemanticMemory(statecli, memoryDir);

    // 1. Index sample changes
    console.log('Indexing sample changes...');

    const changes = [
        {
            id: 'change-1',
            entity: 'file:src/auth.ts',
            entityType: 'file',
            entityId: 'src/auth.ts',
            actor: 'dev-alice',
            timestamp: new Date().toISOString(),
            before: null,
            after: { content: 'function login(user, pass) { ... fixed vulnerability ... }' },
            checkpointName: undefined
        },
        {
            id: 'change-2',
            entity: 'file:src/db/query.ts',
            entityType: 'file',
            entityId: 'src/db/query.ts',
            actor: 'dev-bob',
            timestamp: new Date().toISOString(),
            before: null,
            after: { content: 'const optimizeQuery = (sql) => { ... added index ... }' },
            checkpointName: undefined
        },
        {
            id: 'change-3',
            entity: 'file:src/ui/button.tsx',
            entityType: 'file',
            entityId: 'src/ui/button.tsx',
            actor: 'dev-charlie',
            timestamp: new Date().toISOString(),
            before: null,
            after: { content: 'export const Button = () => <button className="primary">Click</button>' },
            checkpointName: undefined
        }
    ];

    for (const change of changes) {
        await semantic.indexChange(change);
        console.log(`Indexed change for ${change.entity}`);
    }

    // Allow some time for indexing (though it should be awaited)
    console.log('Indexing complete. Running queries...');

    // 2. Query Memory
    const queries = [
        { q: "fix security issue", expected: 'src/auth.ts' },
        { q: "database performance", expected: 'src/db/query.ts' },
        { q: "frontend component", expected: 'src/ui/button.tsx' }
    ];

    let successCount = 0;

    for (const query of queries) {
        console.log(`\nQuery: "${query.q}"`);
        const results = await semantic.search(query.q, 1);

        if (results.length > 0) {
            const topResult = results[0];
            console.log(`  Top Result: ${topResult.change.entity} (Score: ${topResult.score.toFixed(4)})`);
            console.log(`  Summary: ${topResult.summary.substring(0, 50)}...`);

            if (topResult.change.entity.includes(query.expected)) {
                console.log('  ✅ MATCH');
                successCount++;
            } else {
                console.log(`  ❌ MISMATCH (Expected ${query.expected})`);
            }
        } else {
            console.log('  ❌ NO RESULTS');
        }
    }

    console.log(`\nVerification Summary: ${successCount}/${queries.length} passed.`);

    if (successCount === queries.length) {
        console.log('Semantic Intelligence Verified Successfully!');
        process.exit(0);
    } else {
        console.error('Verification Failed.');
        process.exit(1);
    }
}

verifySemanticSearch().catch(err => {
    console.error('Verification crashed:', err);
    process.exit(1);
});
