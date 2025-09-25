// =====================================================
// IMMEDIATE API KEY FIX - Run this in browser console
// =====================================================

console.log('🔧 Starting immediate API key fix...');

try {
    // Get current user
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');

    if (!currentUser.id) {
        console.error('❌ No current user found');
        return;
    }

    console.log('👤 Current user:', currentUser.id);

    // Fix localStorage settings
    const settingsKey = `settings_${currentUser.id}`;
    const settings = JSON.parse(localStorage.getItem(settingsKey) || '{}');

    console.log('📦 Current settings:', {
        retellApiKey: settings.retellApiKey?.substring(0, 20) + '...',
        callAgentId: settings.callAgentId,
        smsAgentId: settings.smsAgentId
    });

    // Set the correct plain text values
    settings.retellApiKey = 'key_c3f084f5ca67781070e188b47d7f';
    settings.callAgentId = 'agent_447a1b9da540237693b0440df6';
    settings.smsAgentId = 'agent_643486efd4b5a0e9d7e094ab99';

    // Save to localStorage
    localStorage.setItem(settingsKey, JSON.stringify(settings));

    console.log('✅ localStorage updated with correct values');

    // Also update any other potential storage locations
    const allKeys = Object.keys(localStorage);
    console.log('🔍 Checking all localStorage keys for encrypted values...');

    allKeys.forEach(key => {
        try {
            const value = localStorage.getItem(key);
            if (value && value.includes('cbc:QNI98cEqIP')) {
                console.log(`🔧 Found encrypted value in key: ${key}`);

                // Try to replace the encrypted value with the correct key
                const updatedValue = value.replace(/cbc:QNI98cEqIP[^"]+/g, 'key_c3f084f5ca67781070e188b47d7f');
                localStorage.setItem(key, updatedValue);
                console.log(`✅ Updated ${key}`);
            }
        } catch (e) {
            // Skip non-JSON values
        }
    });

    // Force update the retell service if it exists
    if (window.retellService) {
        console.log('🔄 Updating retell service...');
        window.retellService.updateCredentials(
            'key_c3f084f5ca67781070e188b47d7f',
            'agent_447a1b9da540237693b0440df6',
            'agent_643486efd4b5a0e9d7e094ab99'
        );
        console.log('✅ Retell service updated');
    }

    console.log('🎉 API key fix completed successfully!');
    console.log('🔄 Refreshing page to load corrected values...');

    // Refresh the page
    setTimeout(() => {
        window.location.reload();
    }, 1000);

} catch (error) {
    console.error('❌ Error during API key fix:', error);
}