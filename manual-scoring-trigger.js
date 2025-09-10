const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://dejuwyeypiggvlyfliap.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlanV3eWV5cGlnZ3ZseWZsaWFwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Mzk2NTgwOCwiZXhwIjoyMDY5NTQxODA4fQ.Bt7AJXsNVZhPjIi7RlkYLIY2J5Ej72LM02R0mwmJzWY'
);

async function triggerScoring() {
  console.log('Triggering scoring function...');
  
  const { data, error } = await supabase.functions.invoke('pickem-scoring', {
    body: { manual: true }
  });
  
  if (error) {
    console.error('Error triggering scoring:', error);
  } else {
    console.log('Scoring triggered successfully:', data);
  }
}

triggerScoring();