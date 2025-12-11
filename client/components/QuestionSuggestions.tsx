import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/lib/auth";
import { apiRequest, getAuthHeaders } from "@/lib/api";
import { Spacing, BorderRadius } from "@/constants/theme";

const questionsByCategory: Record<string, string[]> = {
  "Parent-Child": [
    "What's one family tradition you hope to continue?",
    "When did you feel most proud of me recently?",
    "What was your biggest worry as a teenager?",
    "What's something you wish you could tell your younger self?",
    "What family story do you think I should know?",
    "How have you grown as a person since becoming a parent?",
    "What's one thing you hope I remember about our relationship?",
    "What was the most challenging part of your childhood?",
    "What do you think our family does really well together?",
    "What's a mistake you made that taught you something important?",
    "What are you most excited about for my future?",
    "What values do you hope I carry with me through life?",
  ],
  
  "Romantic Partners": [
    "What's one dream we haven't talked about yet?",
    "When do you feel most connected to me?",
    "What's something small I do that makes you smile?",
    "How have you grown since we've been together?",
    "What's your favorite memory of us from this year?",
    "What do you need more of in our relationship?",
    "What's something you're grateful for about our partnership?",
    "How do you see our relationship evolving in the future?",
    "What's one way I can better support your dreams?",
    "What challenge are you facing that I might not know about?",
    "What adventure do you want us to take together?",
    "What about our relationship surprises you most?",
  ],

  "Friends": [
    "What's one thing you've learned about yourself this year?",
    "If you could time travel, what period would you visit?",
    "What's the best advice someone has given you lately?",
    "What's something you're working on that excites you?",
    "What's a fear you've been trying to overcome?",
    "Who has influenced you the most recently and why?",
    "What's your biggest hope for the next five years?",
    "What's something you want to try but haven't yet?",
    "What book or movie has changed your perspective lately?",
    "What's the most meaningful compliment you've received?",
    "What tradition or ritual makes you feel grounded?",
    "What's one thing you wish people understood about you?",
  ],

  "Siblings": [
    "What's your favorite childhood memory of us together?",
    "How has our relationship changed as we've grown up?",
    "What do you think I'm really good at?",
    "What family trait do you think we both inherited?",
    "What's something you always admired about me?",
    "How do you think we're similar and different?",
    "What role did I play in your childhood?",
    "What's a lesson you learned from watching me?",
    "What do you hope our relationship looks like in 10 years?",
    "What family story always makes you laugh?",
    "What's something you want to tell our future kids about growing up together?",
    "What support do you need from me right now?",
  ],

  "Grandparents": [
    "What was the world like when you were my age?",
    "What's the most important lesson life has taught you?",
    "What's something you want me to always remember?",
    "What was your favorite thing about being young?",
    "What change have you seen that amazes you most?",
    "What wisdom do you wish you could pass on to everyone?",
    "What's your proudest moment as a grandparent?",
    "What tradition from your childhood do you miss?",
    "What do you hope I learn that you had to figure out the hard way?",
    "What's the best decision you ever made?",
    "What do you want your legacy to be?",
    "What story about our family should never be forgotten?",
  ],

  "Long-distance": [
    "What's something beautiful you saw today?",
    "If I were there right now, what would we do?",
    "What's one thing that reminded you of me this week?",
    "What's your favorite memory of us when we were last together?",
    "What are you most looking forward to when we see each other next?",
    "What's something happening in your daily life that I'd find interesting?",
    "How has being apart changed how you think about our relationship?",
    "What's a small moment from your day you want to share with me?",
    "What's something you wish I could experience with you right now?",
    "What song or movie made you think of me recently?",
    "What's one thing you appreciate about me more because of the distance?",
    "What dream do you have about our future together?",
  ],

  "Other": [
    "What's something you've been thinking about lately?",
    "What's bringing you joy right now?",
    "What challenge are you facing that you'd like support with?",
    "What's something you're grateful for today?",
    "What's a goal you're working toward?",
    "What's something you wish more people knew about you?",
    "What's the most interesting thing you've learned recently?",
    "What's a value that's important to you and why?",
    "What's something that always makes you feel better?",
    "What's a question you've been asking yourself?",
    "What's something you want to get better at?",
    "What's a memory that always makes you smile?",
  ],
};

function getQuestionsByCategory(category: string): string[] {
  return questionsByCategory[category as keyof typeof questionsByCategory] || questionsByCategory["Other"];
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

interface QuestionSuggestionsProps {
  relationshipType?: string;
  connectionId?: number;
  conversationId?: number;
  partnerName?: string;
  onSelectQuestion: (question: string) => void;
  onClose: () => void;
}

export function QuestionSuggestions({ relationshipType, connectionId, conversationId, partnerName, onSelectQuestion, onClose }: QuestionSuggestionsProps) {
  const { theme } = useTheme();
  const { token } = useAuth();
  
  const availableCategories = relationshipType && questionsByCategory[relationshipType]
    ? [relationshipType, "Other"]
    : Object.keys(questionsByCategory);
  
  const [selectedCategory, setSelectedCategory] = useState(
    relationshipType && questionsByCategory[relationshipType] 
      ? relationshipType 
      : availableCategories[0]
  );

  const [questionMode, setQuestionMode] = useState<"curated" | "ai">("curated");
  const [customPrompt, setCustomPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [shuffledQuestions, setShuffledQuestions] = useState<string[]>([]);
  const [aiQuestions, setAiQuestions] = useState<string[]>([]);
  const [aiError, setAiError] = useState<string | null>(null);

  const currentQuestions = shuffledQuestions.length > 0 
    ? shuffledQuestions 
    : getQuestionsByCategory(selectedCategory);

  const handleShuffle = useCallback(() => {
    const questions = getQuestionsByCategory(selectedCategory);
    setShuffledQuestions(shuffleArray(questions));
  }, [selectedCategory]);

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    setShuffledQuestions([]);
  };

  const handleGenerateAI = async () => {
    setIsGenerating(true);
    setAiError(null);
    
    try {
      const response = await apiRequest<{ questions: string[] }>(
        "/api/ai/generate-questions",
        {
          method: "POST",
          headers: getAuthHeaders(token || ""),
          body: JSON.stringify({
            relationshipType: relationshipType || selectedCategory,
            connectionId,
            conversationId,
            partnerName,
            count: 5,
          }),
        }
      );
      setAiQuestions(response.questions);
    } catch (error: any) {
      const errorMessage = error?.message || "AI generation failed";
      console.log("AI generation error:", errorMessage);
      setAiError(errorMessage.includes("subscription") || errorMessage.includes("premium")
        ? "AI generation requires a premium subscription. Try our curated questions instead."
        : `Unable to generate questions: ${errorMessage}`);
      setQuestionMode("curated");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCustomPromptSubmit = async () => {
    if (!customPrompt.trim()) return;
    
    setIsGenerating(true);
    setAiError(null);
    
    try {
      const response = await apiRequest<{ questions: string[] }>(
        "/api/ai/generate-questions",
        {
          method: "POST",
          headers: getAuthHeaders(token || ""),
          body: JSON.stringify({
            relationshipType: relationshipType || selectedCategory,
            connectionId,
            conversationId,
            partnerName,
            customPrompt: customPrompt.trim(),
            count: 3,
          }),
        }
      );
      setAiQuestions(response.questions);
      setCustomPrompt("");
    } catch (error: any) {
      const errorMessage = error?.message || "AI generation failed";
      console.log("AI generation error:", errorMessage);
      setAiError(errorMessage.includes("subscription") || errorMessage.includes("premium")
        ? "AI generation requires a premium subscription."
        : `Unable to generate questions: ${errorMessage}`);
      setQuestionMode("curated");
    } finally {
      setIsGenerating(false);
    }
  };

  const getCategoryIcon = (category: string): keyof typeof Feather.glyphMap => {
    const icons: Record<string, keyof typeof Feather.glyphMap> = {
      "Parent-Child": "home",
      "Romantic Partners": "heart",
      "Friends": "users",
      "Siblings": "user-plus",
      "Grandparents": "award",
      "Long-distance": "globe",
      "Other": "message-circle",
    };
    return icons[category] || "message-circle";
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <View style={styles.header}>
        <ThemedText type="h3">Question Ideas</ThemedText>
        <Pressable onPress={onClose} style={styles.closeButton}>
          <Feather name="x" size={24} color={theme.text} />
        </Pressable>
      </View>

      <View style={styles.modeToggle}>
        <Pressable
          style={[
            styles.modeButton,
            { backgroundColor: questionMode === "curated" ? theme.primary : theme.backgroundSecondary },
          ]}
          onPress={() => setQuestionMode("curated")}
        >
          <Feather name="list" size={16} color={questionMode === "curated" ? "#fff" : theme.text} />
          <ThemedText
            type="small"
            style={{ color: questionMode === "curated" ? "#fff" : theme.text, marginLeft: Spacing.xs }}
          >
            Curated
          </ThemedText>
        </Pressable>
        <Pressable
          style={[
            styles.modeButton,
            { backgroundColor: questionMode === "ai" ? theme.accent : theme.backgroundSecondary },
          ]}
          onPress={() => setQuestionMode("ai")}
        >
          <Feather name="zap" size={16} color={questionMode === "ai" ? "#fff" : theme.text} />
          <ThemedText
            type="small"
            style={{ color: questionMode === "ai" ? "#fff" : theme.text, marginLeft: Spacing.xs }}
          >
            AI Generated
          </ThemedText>
        </Pressable>
      </View>

      {questionMode === "curated" ? (
        <>
          <View style={styles.controlsRow}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.categoryTabs}
              contentContainerStyle={styles.categoryTabsContent}
            >
              {availableCategories.map((category) => (
                <Pressable
                  key={category}
                  style={[
                    styles.categoryTab,
                    {
                      backgroundColor:
                        selectedCategory === category
                          ? theme.primary
                          : theme.backgroundSecondary,
                    },
                  ]}
                  onPress={() => handleCategoryChange(category)}
                >
                  <Feather
                    name={getCategoryIcon(category)}
                    size={14}
                    color={selectedCategory === category ? "#fff" : theme.text}
                  />
                  <ThemedText
                    type="small"
                    style={{
                      color: selectedCategory === category ? "#fff" : theme.text,
                      marginLeft: Spacing.xs,
                    }}
                  >
                    {category}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>
            
            <Pressable
              style={[styles.shuffleButton, { backgroundColor: theme.accent }]}
              onPress={handleShuffle}
            >
              <Feather name="shuffle" size={18} color="#fff" />
            </Pressable>
          </View>

          <ScrollView
            style={styles.questionsList}
            showsVerticalScrollIndicator={false}
          >
            {currentQuestions.map((question, index) => (
              <Pressable
                key={index}
                style={[styles.questionItem, { backgroundColor: theme.backgroundSecondary }]}
                onPress={() => onSelectQuestion(question)}
              >
                <ThemedText type="body" style={styles.questionText}>
                  {question}
                </ThemedText>
                <Feather name="chevron-right" size={20} color={theme.textSecondary} />
              </Pressable>
            ))}
          </ScrollView>
        </>
      ) : (
        <>
          <View style={[styles.customPromptContainer, { backgroundColor: theme.backgroundSecondary }]}>
            <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
              Describe what you'd like to explore:
            </ThemedText>
            <View style={styles.customPromptRow}>
              <TextInput
                style={[styles.customPromptInput, { color: theme.text, backgroundColor: theme.backgroundDefault }]}
                placeholder="e.g., childhood memories, future hopes..."
                placeholderTextColor={theme.textSecondary}
                value={customPrompt}
                onChangeText={setCustomPrompt}
              />
              <Pressable
                style={[styles.generateButton, { backgroundColor: theme.accent }]}
                onPress={handleCustomPromptSubmit}
                disabled={isGenerating || !customPrompt.trim()}
              >
                {isGenerating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Feather name="zap" size={18} color="#fff" />
                )}
              </Pressable>
            </View>
          </View>

          {aiQuestions.length === 0 ? (
            <View style={styles.generateSection}>
              <Pressable
                style={[styles.generateAllButton, { backgroundColor: theme.primary }]}
                onPress={handleGenerateAI}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Feather name="zap" size={20} color="#fff" />
                    <ThemedText type="body" style={{ color: "#fff", marginLeft: Spacing.sm }}>
                      Generate Questions for {selectedCategory}
                    </ThemedText>
                  </>
                )}
              </Pressable>
              <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: "center", marginTop: Spacing.md }}>
                AI will create personalized questions based on your relationship type
              </ThemedText>
              {aiError ? (
                <View style={[styles.errorBox, { backgroundColor: theme.error + "15", borderColor: theme.error + "30" }]}>
                  <Feather name="alert-circle" size={16} color={theme.error} />
                  <ThemedText type="small" style={{ color: theme.error, marginLeft: Spacing.sm, flex: 1 }}>
                    {aiError}
                  </ThemedText>
                </View>
              ) : null}
            </View>
          ) : (
            <ScrollView
              style={styles.questionsList}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.aiHeader}>
                <View style={[styles.aiBadge, { backgroundColor: theme.accent + "20" }]}>
                  <Feather name="zap" size={12} color={theme.accent} />
                  <ThemedText type="small" style={{ color: theme.accent, marginLeft: Spacing.xs }}>
                    AI Generated
                  </ThemedText>
                </View>
                <Pressable onPress={handleGenerateAI} disabled={isGenerating}>
                  <Feather name="refresh-cw" size={18} color={theme.primary} />
                </Pressable>
              </View>
              {aiQuestions.map((question, index) => (
                <Pressable
                  key={index}
                  style={[styles.questionItem, styles.aiQuestionItem, { backgroundColor: theme.backgroundSecondary, borderColor: theme.accent + "30" }]}
                  onPress={() => onSelectQuestion(question)}
                >
                  <ThemedText type="body" style={styles.questionText}>
                    {question}
                  </ThemedText>
                  <Feather name="chevron-right" size={20} color={theme.accent} />
                </Pressable>
              ))}
            </ScrollView>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
    maxHeight: 500,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.lg,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  modeToggle: {
    flexDirection: "row",
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  modeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: Spacing.md,
  },
  categoryTabs: {
    flex: 1,
    maxHeight: 50,
  },
  categoryTabsContent: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  categoryTab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginRight: Spacing.sm,
  },
  shuffleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  questionsList: {
    padding: Spacing.md,
  },
  questionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  aiQuestionItem: {
    borderWidth: 1,
  },
  questionText: {
    flex: 1,
    marginRight: Spacing.md,
  },
  customPromptContainer: {
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  customPromptRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  customPromptInput: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    fontSize: 14,
  },
  generateButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  generateSection: {
    padding: Spacing.xl,
    alignItems: "center",
  },
  generateAllButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
  },
  aiHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginTop: Spacing.md,
  },
});
