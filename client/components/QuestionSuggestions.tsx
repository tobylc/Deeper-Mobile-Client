import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
} from "react-native";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface Question {
  id: number;
  text: string;
  category: string;
}

interface QuestionCategory {
  id: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  questions: Question[];
}

const QUESTION_CATEGORIES: Record<string, QuestionCategory[]> = {
  "Parent-Child": [
    {
      id: "memories",
      label: "Memories",
      icon: "camera",
      questions: [
        { id: 1, text: "What's your favorite memory of us together?", category: "memories" },
        { id: 2, text: "What was your happiest moment from my childhood?", category: "memories" },
        { id: 3, text: "What tradition do you wish we kept?", category: "memories" },
      ],
    },
    {
      id: "understanding",
      label: "Understanding",
      icon: "heart",
      questions: [
        { id: 4, text: "What do you wish I understood better about you?", category: "understanding" },
        { id: 5, text: "What was the hardest part about raising me?", category: "understanding" },
        { id: 6, text: "What life lesson took you the longest to learn?", category: "understanding" },
      ],
    },
    {
      id: "dreams",
      label: "Dreams",
      icon: "star",
      questions: [
        { id: 7, text: "What dreams did you have for me when I was born?", category: "dreams" },
        { id: 8, text: "What do you hope our relationship looks like in 10 years?", category: "dreams" },
        { id: 9, text: "What's something you've always wanted to tell me?", category: "dreams" },
      ],
    },
  ],
  "Romantic Partners": [
    {
      id: "connection",
      label: "Connection",
      icon: "link",
      questions: [
        { id: 10, text: "When did you first know you loved me?", category: "connection" },
        { id: 11, text: "What's something small I do that means a lot to you?", category: "connection" },
        { id: 12, text: "What makes you feel most connected to me?", category: "connection" },
      ],
    },
    {
      id: "growth",
      label: "Growth",
      icon: "trending-up",
      questions: [
        { id: 13, text: "How have I helped you grow as a person?", category: "growth" },
        { id: 14, text: "What challenge do you think we've overcome together?", category: "growth" },
        { id: 15, text: "What's something you'd like us to work on together?", category: "growth" },
      ],
    },
    {
      id: "future",
      label: "Future",
      icon: "compass",
      questions: [
        { id: 16, text: "What adventure would you like us to have together?", category: "future" },
        { id: 17, text: "What does your ideal day with me look like?", category: "future" },
        { id: 18, text: "What are you most excited about for our future?", category: "future" },
      ],
    },
  ],
  Friends: [
    {
      id: "bond",
      label: "Bond",
      icon: "users",
      questions: [
        { id: 19, text: "What made you want to be my friend?", category: "bond" },
        { id: 20, text: "What's your favorite thing about our friendship?", category: "bond" },
        { id: 21, text: "When did you realize we'd be close friends?", category: "bond" },
      ],
    },
    {
      id: "support",
      label: "Support",
      icon: "shield",
      questions: [
        { id: 22, text: "How can I be a better friend to you?", category: "support" },
        { id: 23, text: "What's a time I really showed up for you?", category: "support" },
        { id: 24, text: "What do you need most from our friendship right now?", category: "support" },
      ],
    },
    {
      id: "adventures",
      label: "Adventures",
      icon: "map",
      questions: [
        { id: 25, text: "What's your favorite memory of us?", category: "adventures" },
        { id: 26, text: "What bucket list item should we do together?", category: "adventures" },
        { id: 27, text: "What adventure should we plan next?", category: "adventures" },
      ],
    },
  ],
  Siblings: [
    {
      id: "childhood",
      label: "Childhood",
      icon: "home",
      questions: [
        { id: 28, text: "What's your favorite childhood memory of us?", category: "childhood" },
        { id: 29, text: "What did you think of me when we were kids?", category: "childhood" },
        { id: 30, text: "What family tradition do you miss most?", category: "childhood" },
      ],
    },
    {
      id: "understanding",
      label: "Understanding",
      icon: "heart",
      questions: [
        { id: 31, text: "What do you wish I understood about your life now?", category: "understanding" },
        { id: 32, text: "What's something about our childhood I might have missed?", category: "understanding" },
        { id: 33, text: "How has our relationship changed over the years?", category: "understanding" },
      ],
    },
  ],
  Colleagues: [
    {
      id: "professional",
      label: "Professional",
      icon: "briefcase",
      questions: [
        { id: 34, text: "What's the most valuable thing I've taught you?", category: "professional" },
        { id: 35, text: "What skill do you admire most in me?", category: "professional" },
        { id: 36, text: "What project together are you most proud of?", category: "professional" },
      ],
    },
    {
      id: "growth",
      label: "Growth",
      icon: "trending-up",
      questions: [
        { id: 37, text: "How can I better support your career goals?", category: "growth" },
        { id: 38, text: "What feedback have you been hesitant to give me?", category: "growth" },
        { id: 39, text: "What do you see as my biggest growth area?", category: "growth" },
      ],
    },
  ],
};

const DEFAULT_QUESTIONS: QuestionCategory[] = [
  {
    id: "general",
    label: "General",
    icon: "message-circle",
    questions: [
      { id: 100, text: "What's something you've never told me before?", category: "general" },
      { id: 101, text: "What do you wish I understood better about you?", category: "general" },
      { id: 102, text: "What's been on your mind lately?", category: "general" },
      { id: 103, text: "What makes you feel most appreciated?", category: "general" },
      { id: 104, text: "What's something you'd like us to do together?", category: "general" },
      { id: 105, text: "What's the best advice you've ever received?", category: "general" },
    ],
  },
];

interface QuestionSuggestionsProps {
  relationshipType?: string;
  onSelectQuestion: (question: string) => void;
  onClose: () => void;
}

export function QuestionSuggestions({ relationshipType, onSelectQuestion, onClose }: QuestionSuggestionsProps) {
  const { theme } = useTheme();
  const categories = QUESTION_CATEGORIES[relationshipType || ""] || DEFAULT_QUESTIONS;
  const [selectedCategory, setSelectedCategory] = useState(categories[0]?.id || "");

  const currentCategory = categories.find((c) => c.id === selectedCategory) || categories[0];

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <View style={styles.header}>
        <ThemedText type="h3">Question Ideas</ThemedText>
        <Pressable onPress={onClose} style={styles.closeButton}>
          <Feather name="x" size={24} color={theme.text} />
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryTabs}
        contentContainerStyle={styles.categoryTabsContent}
      >
        {categories.map((category) => (
          <Pressable
            key={category.id}
            style={[
              styles.categoryTab,
              {
                backgroundColor:
                  selectedCategory === category.id
                    ? theme.primary
                    : theme.backgroundSecondary,
              },
            ]}
            onPress={() => setSelectedCategory(category.id)}
          >
            <Feather
              name={category.icon}
              size={16}
              color={selectedCategory === category.id ? "#fff" : theme.text}
            />
            <ThemedText
              type="small"
              style={{
                color: selectedCategory === category.id ? "#fff" : theme.text,
                marginLeft: Spacing.xs,
              }}
            >
              {category.label}
            </ThemedText>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView
        style={styles.questionsList}
        showsVerticalScrollIndicator={false}
      >
        {currentCategory?.questions.map((question) => (
          <Pressable
            key={question.id}
            style={[styles.questionItem, { backgroundColor: theme.backgroundSecondary }]}
            onPress={() => onSelectQuestion(question.text)}
          >
            <ThemedText type="body" style={styles.questionText}>
              {question.text}
            </ThemedText>
            <Feather name="chevron-right" size={20} color={theme.textSecondary} />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
    maxHeight: 400,
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
  categoryTabs: {
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
  questionText: {
    flex: 1,
    marginRight: Spacing.md,
  },
});
