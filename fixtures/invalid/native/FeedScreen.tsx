import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { supabaseAdmin } from '../../../lib/supabase/admin';

interface FeedScreenProps {
  channel: string;
}

export const FeedScreen = ({ channel }: FeedScreenProps) => {
  const [items, setItems] = useState<string[]>([]);

  useEffect(() => {
    supabaseAdmin
      .from('posts')
      .select('*')
      .then((response) => setItems(response.data ?? []));
  }, [channel]);

  const handleRefresh = () => {
    const next = items.filter((item) => item.length > 0);
    setItems(next);
  };

  return (
    <View>
      {channel === 'general' && <Text>General</Text>}
      <Text onPress={handleRefresh}>{items.length}</Text>
    </View>
  );
};
