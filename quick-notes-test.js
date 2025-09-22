/**
 * Quick Notes Persistence Test
 *
 * Copy and paste this in the browser console to quickly test notes
 */

console.log('🔧 Quick Notes Test Starting...');

const quickTest = async () => {
  try {
    // Step 1: Test if we can access the notesService
    console.log('\n=== Step 1: Check NotesService Access ===');

    if (typeof notesDebug === 'undefined') {
      console.error('❌ notesDebug not available. Make sure you are on the CareXPS application page.');
      return;
    }

    console.log('✅ notesDebug available');

    // Step 2: Check user info
    console.log('\n=== Step 2: Check User Authentication ===');
    const userInfo = await notesDebug.getUserInfo();
    console.log('User Info:', userInfo);

    if (!userInfo || !userInfo.id) {
      console.error('❌ No user ID found. This might be the issue!');
      console.log('Checking localStorage for currentUser...');
      const currentUser = localStorage.getItem('currentUser');
      console.log('currentUser in localStorage:', currentUser);
      return;
    }

    console.log('✅ User ID found:', userInfo.id);

    // Step 3: Test Supabase connection
    console.log('\n=== Step 3: Test Supabase Connection ===');
    const connectionOk = await notesDebug.testConnection();
    console.log('Supabase connection:', connectionOk ? '✅ Working' : '❌ Failed');

    // Step 4: Create a simple test note
    console.log('\n=== Step 4: Create Test Note ===');
    const testCallId = 'quick-test-' + Date.now();
    const testContent = 'Quick test note - ' + new Date().toLocaleString();

    console.log('Creating note for call ID:', testCallId);
    console.log('Note content:', testContent);

    // Access the notes service through the debug interface
    const result = await notesDebug.debug(testCallId, 'call');
    console.log('Initial state before creating note:', result.summary);

    // Try to create note using the window API
    if (window.notesService) {
      const createResult = await window.notesService.createNote({
        reference_id: testCallId,
        reference_type: 'call',
        content: testContent,
        content_type: 'plain'
      });

      console.log('Create result:', createResult);

      if (createResult.success) {
        console.log('✅ Note created successfully!');

        // Wait a moment
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Check if it persists
        console.log('\n=== Step 5: Check Persistence ===');
        const afterResult = await notesDebug.debug(testCallId, 'call');
        console.log('State after creating note:', afterResult.summary);

        if (afterResult.localStorage.length > 0 || afterResult.supabase.length > 0) {
          console.log('✅ Note persisted successfully!');
          console.log('localStorage notes:', afterResult.localStorage.length);
          console.log('Supabase notes:', afterResult.supabase.length);
        } else {
          console.error('❌ Note was created but not persisted!');
          console.log('This is the bug we need to fix.');
        }
      } else {
        console.error('❌ Failed to create note:', createResult.error);
      }
    } else {
      console.error('❌ notesService not available on window object');
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error);
    console.error('Error details:', error.stack);
  }
};

// Run the quick test
quickTest();

console.log(`
🔧 Quick Notes Test Script

This script will:
1. Check if debugging tools are available
2. Verify user authentication
3. Test Supabase connection
4. Create a test note
5. Check if the note persists

If any step fails, it will show you exactly what's wrong.
`);