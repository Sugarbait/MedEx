// Copy and paste this entire block into browser console:

var currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
if (currentUser.id) {
    var settingsKey = 'settings_' + currentUser.id;
    var settings = JSON.parse(localStorage.getItem(settingsKey) || '{}');

    settings.retellApiKey = 'key_c3f084f5ca67781070e188b47d7f';
    settings.callAgentId = 'agent_447a1b9da540237693b0440df6';
    settings.smsAgentId = 'agent_643486efd4b5a0e9d7e094ab99';

    localStorage.setItem(settingsKey, JSON.stringify(settings));

    console.log('✅ API key fixed to:', settings.retellApiKey);
    console.log('🔄 Refreshing page...');

    setTimeout(function() {
        window.location.reload();
    }, 500);
} else {
    console.error('❌ No user found');
}