#!/usr/bin/env ts-node

import { Command } from 'commander';
import { ChatOrchestrator } from '../ChatOrchestrator';
import * as dotenv from 'dotenv';

dotenv.config();

const program = new Command();

program
  .name('ai-chat-cli')
  .description('CLI tool for AI chat platform automation')
  .version('1.0.0');

program
  .command('list')
  .description('List all available platforms')
  .action(() => {
    const orchestrator = new ChatOrchestrator();
    const platforms = orchestrator.getAvailablePlatforms();
    
    console.log('\n📋 Available Platforms:');
    console.log('='.repeat(40));
    
    if (platforms.length === 0) {
      console.log('❌ No platforms configured');
      console.log('   Please check your .env file');
    } else {
      platforms.forEach((platform, index) => {
        console.log(`${index + 1}. ${platform}`);
      });
    }
    
    console.log('='.repeat(40) + '\n');
  });

program
  .command('send')
  .description('Send a message to specific platform or all')
  .argument('<message>', 'Message to send')
  .option('-p, --platform <name>', 'Platform name (or "all")')
  .option('-s, --sequential', 'Send sequentially instead of parallel (for "all")')
  .action(async (message, options) => {
    const orchestrator = new ChatOrchestrator();
    
    console.log(`\n🚀 Sending message: "${message}"\n`);

    if (!options.platform || options.platform === 'all') {
      console.log('📡 Sending to all platforms...\n');
      
      const results = options.sequential
        ? await orchestrator.sendToAllSequential(message)
        : await orchestrator.sendToAll(message);
      
      displayResults(results);
    } else {
      if (!orchestrator.isPlatformAvailable(options.platform)) {
        console.error(`❌ Platform "${options.platform}" not found or not configured`);
        console.log('   Use "list" command to see available platforms');
        process.exit(1);
      }

      console.log(`📡 Sending to ${options.platform}...\n`);
      const result = await orchestrator.sendToPlatform(options.platform, message);
      displayResults([result]);
    }
  });

program
  .command('test')
  .description('Test "how are you" on all platforms')
  .action(async () => {
    const orchestrator = new ChatOrchestrator();
    const message = 'how are you';
    
    console.log('\n🧪 Running test with message: "how are you"\n');
    console.log('📡 Sending to all platforms...\n');
    
    const results = await orchestrator.sendToAll(message);
    displayResults(results);
  });

function displayResults(results: any[]) {
  console.log('='.repeat(60));
  console.log('📊 RESULTS');
  console.log('='.repeat(60));

  results.forEach((result, index) => {
    console.log(`\n${index + 1}. ${result.platform}`);
    console.log(`   Status: ${result.success ? '✅ Success' : '❌ Failed'}`);
    console.log(`   Duration: ${(result.duration / 1000).toFixed(2)}s`);
    console.log(`   Timestamp: ${result.timestamp.toISOString()}`);
    
    if (result.success && result.response) {
      const preview = result.response.length > 150 
        ? result.response.substring(0, 150) + '...'
        : result.response;
      console.log(`   Response: ${preview}`);
    } else if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });

  console.log('\n' + '='.repeat(60));
  const successful = results.filter(r => r.success).length;
  const total = results.length;
  console.log(`✅ Successful: ${successful}/${total}`);
  
  if (successful < total) {
    console.log(`❌ Failed: ${total - successful}/${total}`);
  }
  
  console.log('='.repeat(60) + '\n');
}

program.parse();

