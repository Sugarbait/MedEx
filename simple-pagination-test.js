// Simple SMS Pagination Test Script
// Run this in browser console on SMS page to debug pagination

console.log("🔍 SMS PAGINATION DEBUG TEST STARTING...");

// Test 1: Check if pagination elements exist
function testPaginationElements() {
    console.log("\n📊 TEST 1: Checking for pagination elements...");

    const selectors = [
        'button[onclick*="setCurrentPage"]',
        'button[onclick*="Page"]',
        '[class*="pagination"]',
        '.page-button',
        'button:contains("2")',
        'button:contains("3")',
        'button:contains("Next")',
        'button:contains("Previous")'
    ];

    let totalFound = 0;
    selectors.forEach(selector => {
        try {
            const elements = document.querySelectorAll(selector);
            console.log(`   ${selector}: ${elements.length} elements`);
            totalFound += elements.length;
        } catch (error) {
            console.log(`   ${selector}: Error - ${error.message}`);
        }
    });

    console.log(`   🎯 Total pagination elements found: ${totalFound}`);
    return totalFound;
}

// Test 2: Check React component state
function testReactState() {
    console.log("\n⚛️ TEST 2: Checking React component state...");

    try {
        // Look for React fiber nodes
        const reactElements = document.querySelectorAll('[data-reactroot], #root *');
        console.log(`   Found ${reactElements.length} potential React elements`);

        // Check window for React dev tools
        if (window.React) {
            console.log("   ✅ React detected on window");
        } else {
            console.log("   ❌ React not found on window");
        }

        // Look for state variables in localStorage
        const storageKeys = Object.keys(localStorage).filter(key =>
            key.includes('page') || key.includes('pagination') || key.includes('current')
        );
        console.log(`   📱 Storage keys related to pagination: ${storageKeys.join(', ')}`);

    } catch (error) {
        console.log(`   ❌ Error checking React state: ${error.message}`);
    }
}

// Test 3: Check for JavaScript errors
function testForErrors() {
    console.log("\n🐛 TEST 3: Checking for JavaScript errors...");

    const originalError = window.onerror;
    let errorCount = 0;

    window.onerror = function(message, source, lineno, colno, error) {
        errorCount++;
        console.log(`   ❌ ERROR ${errorCount}: ${message} at ${source}:${lineno}`);
        if (originalError) originalError.apply(this, arguments);
    };

    // Check console for existing errors
    console.log("   👁️ Error monitoring activated");

    setTimeout(() => {
        console.log(`   📊 Total errors detected: ${errorCount}`);
        window.onerror = originalError;
    }, 5000);
}

// Test 4: Check current page data
function testCurrentPageData() {
    console.log("\n📋 TEST 4: Checking current page data...");

    try {
        // Look for table rows or chat items
        const dataSelectors = [
            'table tbody tr',
            '.chat-item',
            '[class*="chat"]',
            '[class*="sms"]',
            '.table-row'
        ];

        let totalDataItems = 0;
        dataSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            console.log(`   ${selector}: ${elements.length} items`);
            totalDataItems += elements.length;
        });

        console.log(`   📊 Total data items on page: ${totalDataItems}`);

        // Check for "Showing X to Y of Z" text
        const showingText = Array.from(document.querySelectorAll('*')).find(el =>
            el.textContent && el.textContent.includes('Showing')
        );

        if (showingText) {
            console.log(`   📄 Found pagination info: "${showingText.textContent.trim()}"`);
        } else {
            console.log("   ❌ No 'Showing X to Y of Z' text found");
        }

    } catch (error) {
        console.log(`   ❌ Error checking page data: ${error.message}`);
    }
}

// Test 5: Test pagination button clicks
function testPaginationClicks() {
    console.log("\n🖱️ TEST 5: Testing pagination button clicks...");

    try {
        // Find potential pagination buttons
        const buttons = Array.from(document.querySelectorAll('button')).filter(btn => {
            const text = btn.textContent.trim();
            return /^\d+$/.test(text) || text.includes('Next') || text.includes('Previous');
        });

        console.log(`   🔍 Found ${buttons.length} potential pagination buttons`);

        buttons.forEach((btn, index) => {
            console.log(`   Button ${index + 1}: "${btn.textContent.trim()}" - ${btn.disabled ? 'DISABLED' : 'ENABLED'}`);

            if (btn.onclick) {
                console.log(`     Has onclick handler: ${btn.onclick.toString().substring(0, 100)}...`);
            } else {
                console.log(`     ❌ No onclick handler`);
            }
        });

        // Try clicking the "2" button if it exists
        const page2Button = buttons.find(btn => btn.textContent.trim() === '2');
        if (page2Button && !page2Button.disabled) {
            console.log(`   🚀 Attempting to click page 2 button...`);
            page2Button.click();

            setTimeout(() => {
                console.log(`   📊 Page after click - checking for changes...`);
                testCurrentPageData();
            }, 1000);
        } else {
            console.log(`   ❌ Page 2 button not found or disabled`);
        }

    } catch (error) {
        console.log(`   ❌ Error testing clicks: ${error.message}`);
    }
}

// Test 6: Check network requests
function testNetworkRequests() {
    console.log("\n🌐 TEST 6: Monitoring network requests...");

    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        console.log(`   📡 FETCH REQUEST: ${args[0]}`);
        return originalFetch.apply(this, args);
    };

    const originalXHR = window.XMLHttpRequest.prototype.open;
    window.XMLHttpRequest.prototype.open = function(method, url) {
        console.log(`   📡 XHR REQUEST: ${method} ${url}`);
        return originalXHR.apply(this, arguments);
    };

    console.log("   👁️ Network monitoring activated");
}

// Run all tests
function runAllTests() {
    console.log("🚀 RUNNING ALL SMS PAGINATION TESTS...\n");

    testPaginationElements();
    testReactState();
    testForErrors();
    testCurrentPageData();
    testNetworkRequests();

    setTimeout(() => {
        testPaginationClicks();
    }, 2000);

    console.log("\n✅ All tests initiated. Check results above.");
    console.log("💡 If pagination buttons are found but not working, the issue is likely in click handlers or state management.");
    console.log("💡 If no pagination buttons are found, the issue is in rendering/DOM generation.");
}

// Auto-run tests
runAllTests();

// Expose functions for manual testing
window.paginationTest = {
    runAll: runAllTests,
    elements: testPaginationElements,
    reactState: testReactState,
    errors: testForErrors,
    pageData: testCurrentPageData,
    clicks: testPaginationClicks,
    network: testNetworkRequests
};

console.log("\n🎯 Tests complete! You can run individual tests with:");
console.log("   window.paginationTest.elements()");
console.log("   window.paginationTest.clicks()");
console.log("   window.paginationTest.pageData()");