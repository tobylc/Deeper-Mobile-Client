/**
 * Thread naming utilities for automatically generating conversation titles
 * based on the original question content
 */

export function generateThreadTitle(questionContent: string): string {
  // Clean the question content
  const cleaned = questionContent.trim();
  
  // If it's already short enough, use it as-is
  if (cleaned.length <= 35) {
    return cleaned;
  }
  
  // Extract key phrases and create a summary
  const words = cleaned.split(/\s+/);
  
  // Look for question words and important content
  const questionWords = ['what', 'when', 'where', 'why', 'how', 'who', 'which', 'would', 'could', 'should', 'do', 'did', 'can', 'will'];
  const importantWords = words.filter(word => {
    const lower = word.toLowerCase().replace(/[^\w]/g, '');
    return lower.length > 3 && !isCommonWord(lower);
  });
  
  // Try to find the core question structure
  let title = '';
  
  // Look for question pattern
  const firstWord = words[0]?.toLowerCase().replace(/[^\w]/g, '');
  if (questionWords.includes(firstWord)) {
    // Start with question word
    title = words[0];
    
    // Add important words until we reach a good length (max 5 words for conciseness)
    let wordCount = 1;
    for (let i = 1; i < words.length && wordCount < 5; i++) {
      const word = words[i].toLowerCase().replace(/[^\w]/g, '');
      if (!isCommonWord(word) || word.length > 4) {
        title += ' ' + words[i];
        wordCount++;
      }
    }
  } else {
    // Extract key phrases for non-question format (max 4 words)
    title = importantWords.slice(0, 4).join(' ');
  }
  
  // Clean up the title
  title = title.replace(/[.!?]+$/, ''); // Remove trailing punctuation
  title = title.trim();
  
  // If still too long, truncate intelligently (target max 35 chars)
  if (title.length > 35) {
    const truncated = title.substring(0, 32);
    const lastSpace = truncated.lastIndexOf(' ');
    title = (lastSpace > 15 ? truncated.substring(0, lastSpace) : truncated) + '...';
  }
  
  // Ensure it's not empty
  if (!title || title.length < 3) {
    title = cleaned.substring(0, 32) + (cleaned.length > 32 ? '...' : '');
  }
  
  return title;
}

function isCommonWord(word: string): boolean {
  const commonWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'her', 'its', 'our', 'their'
  ]);
  return commonWords.has(word);
}

/**
 * Generate a relationship-specific thread title
 */
export function generateRelationshipSpecificTitle(questionContent: string, relationshipType: string): string {
  const baseTitle = generateThreadTitle(questionContent);
  
  // Add context clues based on relationship type for better organization
  const relationshipPrefixes: Record<string, string[]> = {
    'Parent-Child': ['Family:', 'Parenting:', 'Growing up:'],
    'Romantic Partners': ['Love:', 'Relationship:', 'Together:'],
    'Friends': ['Friendship:', 'Fun:', 'Memories:'],
    'Siblings': ['Family:', 'Childhood:', 'Siblings:'],
    'Colleagues': ['Work:', 'Career:', 'Professional:'],
    'Mentor-Mentee': ['Learning:', 'Growth:', 'Guidance:']
  };
  
  // Only add prefix if the title doesn't already contain relationship context
  const prefixes = relationshipPrefixes[relationshipType];
  if (prefixes && !containsRelationshipContext(baseTitle, relationshipType)) {
    // Choose prefix based on question content
    const prefix = chooseBestPrefix(baseTitle, prefixes);
    if (prefix && (baseTitle.length + prefix.length + 1) <= 40) {
      return `${prefix} ${baseTitle}`;
    }
  }
  
  return baseTitle;
}

function containsRelationshipContext(title: string, relationshipType: string): boolean {
  const lower = title.toLowerCase();
  const contextWords: Record<string, string[]> = {
    'Parent-Child': ['family', 'parent', 'child', 'mom', 'dad', 'mother', 'father'],
    'Romantic Partners': ['love', 'relationship', 'partner', 'together', 'couple'],
    'Friends': ['friend', 'friendship', 'buddy', 'pal'],
    'Siblings': ['brother', 'sister', 'sibling', 'family'],
    'Colleagues': ['work', 'job', 'career', 'office', 'colleague'],
    'Mentor-Mentee': ['learn', 'teach', 'mentor', 'guide', 'advice']
  };
  
  const words = contextWords[relationshipType] || [];
  return words.some(word => lower.includes(word));
}

function chooseBestPrefix(title: string, prefixes: string[]): string {
  const lower = title.toLowerCase();
  
  // Simple heuristics to choose the most appropriate prefix
  if (lower.includes('remember') || lower.includes('memory') || lower.includes('past')) {
    return prefixes.find(p => p.includes('Memories') || p.includes('Childhood')) || prefixes[0];
  }
  if (lower.includes('future') || lower.includes('goal') || lower.includes('dream')) {
    return prefixes.find(p => p.includes('Growth') || p.includes('Together')) || prefixes[0];
  }
  if (lower.includes('feel') || lower.includes('emotion') || lower.includes('think')) {
    return prefixes.find(p => p.includes('Love') || p.includes('Family')) || prefixes[0];
  }
  
  return prefixes[0]; // Default to first prefix
}