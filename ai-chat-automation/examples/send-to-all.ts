#!/usr/bin/env ts-node

import { ChatOrchestrator } from '../ChatOrchestrator';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function main() {
  console.log('🚀 Starting AI Chat Automation - Send to All Platforms');
  console.log('='.repeat(60));

  const orchestrator = new ChatOrchestrator();
  const message = process.argv[2] || 'how are you';

  console.log(`\n📝 Message: "${message}"`);
  console.log(`\n🎯 Available platforms: ${orchestrator.getAvailablePlatforms().join(', ')}`);
  console.log('\n⏳ Sending message to all platforms...\n');

  const startTime = Date.now();
  
  // Send to all platforms in parallel
  const results = await orchestrator.sendToAll(message);

  const totalTime = Date.now() - startTime;

  console.log('\n' + '='.repeat(60));
  console.log('📊 RESULTS');
  console.log('='.repeat(60));

  results.forEach((result, index) => {
    console.log(`\n${index + 1}. ${result.platform}`);
    console.log(`   Status: ${result.success ? '✅ Success' : '❌ Failed'}`);
    console.log(`   Duration: ${(result.duration / 1000).toFixed(2)}s`);
    
    if (result.success && result.response) {
      const preview = result.response.length > 100 
        ? result.response.substring(0, 100) + '...'
        : result.response;
      console.log(`   Response: ${preview}`);
    } else if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });

  console.log('\n' + '='.repeat(60));
  console.log(`✨ Complete! Total time: ${(totalTime / 1000).toFixed(2)}s`);
  console.log(`✅ Successful: ${results.filter(r => r.success).length}/${results.length}`);
  console.log('='.repeat(60));

  // Save results to file
  const fs = require('fs');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `results-${timestamp}.json`;
  
  fs.writeFileSync(
    filename,
    JSON.stringify({ message, results, totalTime }, null, 2)
  );
  
  console.log(`\n💾 Results saved to: ${filename}\n`);
}

main().catch(console.error);

