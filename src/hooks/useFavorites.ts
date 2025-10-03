import { useState, useCallback, useEffect } from 'react';
import { FavoriteMessage } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const FAVORITES_STORAGE_KEY = 'astra-favorite-messages';

export const useFavorites = () => {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<FavoriteMessage[]>([]);
  const [loading, setLoading] = useState(true);

  // Load favorites from database on mount and when user changes
  useEffect(() => {
    const loadFavorites = async () => {
      if (!user) {
        setFavorites([]);
        setLoading(false);
        return;
      }

      try {
        // Try to load from database first
        const { data, error } = await supabase
          .from('astra_saved_prompts')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error loading favorites from database:', error);
          setLoading(false);
          return;
        }

        // Convert database format to FavoriteMessage format
        const dbFavorites: FavoriteMessage[] = (data || []).map((item) => ({
          id: item.id,
          text: item.prompt_text,
          createdAt: new Date(item.created_at)
        }));

        setFavorites(dbFavorites);

        // Check if there are any localStorage favorites to migrate
        const stored = localStorage.getItem(FAVORITES_STORAGE_KEY);
        if (stored && dbFavorites.length === 0) {
          try {
            const parsed = JSON.parse(stored);
            const localFavorites = parsed.map((fav: any) => ({
              ...fav,
              createdAt: new Date(fav.createdAt)
            }));

            // Migrate localStorage favorites to database
            if (localFavorites.length > 0) {
              console.log('Migrating', localFavorites.length, 'favorites from localStorage to database');

              for (const fav of localFavorites) {
                await supabase
                  .from('astra_saved_prompts')
                  .insert({
                    user_id: user.id,
                    prompt_text: fav.text
                  });
              }

              // Clear localStorage after successful migration
              localStorage.removeItem(FAVORITES_STORAGE_KEY);

              // Reload from database to get the migrated data
              const { data: migratedData } = await supabase
                .from('astra_saved_prompts')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

              if (migratedData) {
                const migratedFavorites: FavoriteMessage[] = migratedData.map((item) => ({
                  id: item.id,
                  text: item.prompt_text,
                  createdAt: new Date(item.created_at)
                }));
                setFavorites(migratedFavorites);
              }
            }
          } catch (migrationError) {
            console.error('Error migrating favorites:', migrationError);
          }
        }
      } catch (error) {
        console.error('Error in loadFavorites:', error);
      } finally {
        setLoading(false);
      }
    };

    loadFavorites();
  }, [user]);

  // Add a message to favorites
  const addToFavorites = useCallback(async (messageId: string, text: string) => {
    if (!user) {
      console.error('Cannot add favorite: user not authenticated');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('astra_saved_prompts')
        .insert({
          user_id: user.id,
          prompt_text: text
        })
        .select()
        .single();

      if (error) {
        console.error('Error adding favorite:', error);
        return;
      }

      // Add to local state
      const newFavorite: FavoriteMessage = {
        id: data.id,
        text: data.prompt_text,
        createdAt: new Date(data.created_at)
      };

      setFavorites(prev => [newFavorite, ...prev]);
    } catch (error) {
      console.error('Error in addToFavorites:', error);
    }
  }, [user]);

  // Remove a message from favorites
  const removeFromFavorites = useCallback(async (favoriteId: string) => {
    if (!user) {
      console.error('Cannot remove favorite: user not authenticated');
      return;
    }

    try {
      const { error } = await supabase
        .from('astra_saved_prompts')
        .delete()
        .eq('id', favoriteId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error removing favorite:', error);
        return;
      }

      // Remove from local state
      setFavorites(prev => prev.filter(fav => fav.id !== favoriteId));
    } catch (error) {
      console.error('Error in removeFromFavorites:', error);
    }
  }, [user]);

  // Check if a message text is already favorited
  const isFavorited = useCallback((text: string) => {
    return favorites.some(fav => fav.text === text);
  }, [favorites]);

  // Toggle favorite status - now uses text to check, not messageId
  const toggleFavorite = useCallback(async (messageId: string, text: string) => {
    // Find if this text is already saved
    const existing = favorites.find(fav => fav.text === text);

    if (existing) {
      await removeFromFavorites(existing.id);
    } else {
      await addToFavorites(messageId, text);
    }
  }, [favorites, addToFavorites, removeFromFavorites]);

  return {
    favorites,
    addToFavorites,
    removeFromFavorites,
    isFavorited,
    toggleFavorite,
    loading
  };
};