const GenerateCSVAction = require('./core/src/actions/plugins/generate-csv.js');
const fs = require('fs');
const path = require('path');

async function test() {
    console.log('Testing GenerateCSVAction...');

    // Mock environment
    process.env.DATA_DIR = path.resolve('./temp-data');
    if (!fs.existsSync(process.env.DATA_DIR)) {
        fs.mkdirSync(process.env.DATA_DIR, { recursive: true });
    }

    const action = new GenerateCSVAction({}, {}); // Mock dependencies

    // Test 1: Create new file
    console.log('Test 1: Create new file');
    const data1 = [
        { name: 'Alice', age: 30, city: 'Wonderland' },
        { name: 'Bob', age: 25, city: 'Builderland' }
    ];

    const result1 = await action.execute({
        filename: 'test_users.csv',
        data: data1
    });

    console.log('Result 1:', result1);

    const content1 = fs.readFileSync(path.join(process.env.DATA_DIR, 'output', 'test_users.csv'), 'utf8');
    console.log('Content 1:\n', content1);

    if (!content1.includes('name,age,city') || !content1.includes('Alice')) {
        console.error('FAILED: Content mismatch');
    }

    // Test 2: Append to file
    console.log('\nTest 2: Append to file');
    const data2 = [
        { name: 'Charlie', age: 40, city: 'Chocolate Factory' }
    ];

    const result2 = await action.execute({
        filename: 'test_users.csv',
        data: data2,
        append: true
    });

    console.log('Result 2:', result2);

    const content2 = fs.readFileSync(path.join(process.env.DATA_DIR, 'output', 'test_users.csv'), 'utf8');
    console.log('Content 2:\n', content2);

    if (!content2.includes('Charlie')) {
        console.error('FAILED: Append failed');
    }

    // Cleanup
    fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true });
    console.log('\nDone.');
}

test().catch(console.error);
