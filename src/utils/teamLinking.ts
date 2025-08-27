// Team names and variations for matching - no import needed

// Team names and variations for matching
const TEAM_PATTERNS = [
  // NFL Teams
  { id: '25999306-9f64-4a48-9fa1-ff34fc815b9e', patterns: ['49ers', 'Niners', 'San Francisco'] },
  { id: '2f13c38e-a3aa-4120-9d3b-541501bce85f', patterns: ['Bears', 'Chicago'] },
  { id: '6c4a1a03-0e2d-492a-97e7-2763800d428a', patterns: ['Bengals', 'Cincinnati'] },
  { id: '873029ca-ba96-41e0-9d09-e9e63ab95a78', patterns: ['Bills', 'Buffalo'] },
  { id: '7dbe9b38-a972-4cb2-b9a1-11cca75637e5', patterns: ['Broncos', 'Denver'] },
  { id: '649a1db6-5df3-4e24-b5b1-470f043bdd62', patterns: ['Browns', 'Cleveland'] },
  { id: 'b9c16504-22f2-41e3-a698-cc7802a90fa0', patterns: ['Buccaneers', 'Bucs', 'Tampa Bay'] },
  { id: '568dd2b0-7b18-494b-90ac-36430862b36a', patterns: ['Cardinals', 'Arizona'] },
  { id: 'd1caddb6-4e72-4a36-b130-c1d237c862f3', patterns: ['Chargers', 'Los Angeles Chargers'] },
  { id: '4dedf4f7-fb73-45be-9a14-da6beb9df6c0', patterns: ['Chiefs', 'Kansas City'] },
  { id: 'fa7c4eb4-7119-4da1-8422-cd3eb80ff725', patterns: ['Colts', 'Indianapolis'] },
  { id: 'b236fcad-001b-43de-93cf-548ec7fe22c4', patterns: ['Commanders', 'Washington'] },
  { id: '96522625-0cd9-4f58-8f21-a2b4001b9aaa', patterns: ['Cowboys', 'Dallas'] },
  { id: '64d2f2d5-2465-4f4a-8565-3b6667119044', patterns: ['Dolphins', 'Miami'] },
  { id: '1bb17479-a8d8-4edf-800b-e771f8919c35', patterns: ['Eagles', 'Philadelphia'] },
  { id: '4a07943f-f0b6-4c8b-bcdd-45d69b404bea', patterns: ['Falcons', 'Atlanta'] },
  { id: '0d83dadd-ec74-4a17-845d-6a00d15ce6b2', patterns: ['Giants', 'New York Giants'] },
  { id: '18085b27-0a72-4b93-a258-a635c3b334b0', patterns: ['Jaguars', 'Jacksonville'] },
  { id: '9dbd6b2e-3301-4347-8346-e41fb87dcc48', patterns: ['Jets', 'New York Jets'] },
  { id: '8b740f9a-f9bf-4d50-beaf-4a90672d98bc', patterns: ['Lions', 'Detroit'] },
  { id: 'e3c7f935-505c-4a38-a7e8-b135587e7ed4', patterns: ['Packers', 'Green Bay'] },
  { id: '8d9be8b7-9ef0-4e18-b6cc-42e1fc59b6c4', patterns: ['Panthers', 'Carolina'] },
  { id: '49581517-f193-4b58-ac04-a1b2574d572e', patterns: ['Patriots', 'New England'] },
  { id: 'f563c270-1734-4778-94b8-2a11b70b4764', patterns: ['Raiders', 'Las Vegas'] },
  { id: 'dd6d0593-7c99-4b63-a981-c30c80b20021', patterns: ['Rams', 'Los Angeles Rams'] },
  { id: '700c5c20-2ffa-45a1-8d55-4160a071d831', patterns: ['Ravens', 'Baltimore'] },
  { id: '5acc8f49-c9d4-4a61-8495-ae61dd23da77', patterns: ['Saints', 'New Orleans'] },
  { id: 'a94aa5bc-37a7-40cc-a1d2-f5dbd9c8a5ae', patterns: ['Seahawks', 'Seattle'] },
  { id: 'eec04af2-f763-413f-8c29-37cb400b419a', patterns: ['Steelers', 'Pittsburgh'] },
  { id: 'd0dc6016-932e-428d-97ed-1707e8911030', patterns: ['Texans', 'Houston'] },
  { id: 'b9eab2cf-a275-4db2-aa82-d2a30cd51f04', patterns: ['Titans', 'Tennessee'] },
  { id: '8a1ede9e-40e8-4311-94ca-6f8af38b33f4', patterns: ['Vikings', 'Minnesota'] },
  
  // NCAA Teams
  { id: '9f19b8cd-5b1b-4b0f-a0a4-818fd9b66cd7', patterns: ['Aggies', 'Texas A&M'] },
  { id: '9adb4619-ab1a-4cdf-8c42-dcee715d92d3', patterns: ['Bulldogs', 'Georgia'] },
  { id: '79b5a9a1-7294-4303-a5cf-d8929d1abf59', patterns: ['Crimson Tide', 'Alabama'] },
  { id: '45864425-29c1-4468-83fb-38f0b98e714e', patterns: ['Gators', 'Florida'] },
  { id: '4077fcb4-a4b9-4624-896c-a8cee9c17f87', patterns: ['Tigers', 'LSU'] },
  { id: '5fcc6b69-da55-4951-9432-d8a08daf464a', patterns: ['Tigers', 'Auburn'] },
  { id: '74594ba8-a023-4aa2-9ce2-e152db2bf1da', patterns: ['Volunteers', 'Tennessee'] },
];

/**
 * Converts team names in text to clickable links
 * @param content - The text content to process
 * @returns HTML string with team names converted to links
 */
export const linkifyTeamNames = (content: string): string => {
  if (!content) return content;
  
  let processedContent = content;
  
  // Sort patterns by length (longest first) to avoid partial matches
  const sortedPatterns = [...TEAM_PATTERNS].sort((a, b) => {
    const maxA = Math.max(...a.patterns.map(p => p.length));
    const maxB = Math.max(...b.patterns.map(p => p.length));
    return maxB - maxA;
  });
  
  for (const team of sortedPatterns) {
    for (const pattern of team.patterns) {
      // Create regex that matches the pattern as a whole word
      const regex = new RegExp(`\\b(${pattern})\\b`, 'gi');
      
      processedContent = processedContent.replace(regex, (match) => {
        return `<a href="/teams/${team.id}" class="team-link text-primary hover:text-primary/80 underline transition-colors font-medium">${match}</a>`;
      });
    }
  }
  
  return processedContent;
};

/**
 * Get team info by ID
 * @param teamId - The team ID
 * @returns Team info or null
 */
export const getTeamById = (teamId: string) => {
  return TEAM_PATTERNS.find(team => team.id === teamId);
};