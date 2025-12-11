import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/lib/auth";
import { apiRequest, getAuthHeaders } from "@/lib/api";
import { Spacing, BorderRadius } from "@/constants/theme";
import { AppStackParamList } from "@/navigation/RootStackNavigator";
import { RELATIONSHIP_TYPES } from "@/types/api";

type Props = {
  navigation: NativeStackNavigationProp<AppStackParamList, "InviteConnection">;
};

export default function InviteConnectionScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { user, token } = useAuth();

  const [email, setEmail] = useState("");
  const [selectedRelationship, setSelectedRelationship] = useState<string | null>(null);
  const [inviterRole, setInviterRole] = useState<string | null>(null);
  const [inviteeRole, setInviteeRole] = useState<string | null>(null);
  const [personalMessage, setPersonalMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedRelationshipData = RELATIONSHIP_TYPES.find(
    (r) => r.value === selectedRelationship
  );

  const handleSubmit = async () => {
    if (!email.trim()) {
      Alert.alert("Error", "Please enter an email address");
      return;
    }
    if (!selectedRelationship) {
      Alert.alert("Error", "Please select a relationship type");
      return;
    }
    if (!inviterRole || !inviteeRole) {
      Alert.alert("Error", "Please select roles for both people");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert("Error", "Please enter a valid email address");
      return;
    }

    if (email.trim().toLowerCase() === user?.email?.toLowerCase()) {
      Alert.alert("Error", "You cannot invite yourself");
      return;
    }

    setIsSubmitting(true);
    try {
      await apiRequest(
        "/api/connections",
        {
          method: "POST",
          headers: getAuthHeaders(token!),
          body: JSON.stringify({
            inviterEmail: user?.email,
            inviteeEmail: email.trim().toLowerCase(),
            relationshipType: selectedRelationship,
            inviterRole,
            inviteeRole,
            personalMessage: personalMessage.trim() || null,
          }),
        }
      );
      
      Alert.alert(
        "Invitation Sent!",
        `An invitation has been sent to ${email}. They'll receive an email to join Deeper.`,
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to send invitation");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollViewCompat
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: headerHeight + Spacing.xl,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
      >
        <ThemedText type="h2" style={styles.title}>
          Invite Someone Special
        </ThemedText>
        <ThemedText type="body" style={{ color: theme.textSecondary, marginBottom: Spacing.xl }}>
          Start meaningful conversations with someone you want to connect with more deeply.
        </ThemedText>

        <View style={styles.formGroup}>
          <ThemedText type="h4" style={styles.label}>
            Their Email Address
          </ThemedText>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.inputBackground,
                borderColor: theme.border,
                color: theme.text,
              },
            ]}
            placeholder="Enter email address"
            placeholderTextColor={theme.textSecondary}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
        </View>

        <View style={styles.formGroup}>
          <ThemedText type="h4" style={styles.label}>
            Relationship Type
          </ThemedText>
          <View style={styles.relationshipGrid}>
            {RELATIONSHIP_TYPES.map((type) => (
              <Pressable
                key={type.value}
                style={[
                  styles.relationshipOption,
                  {
                    backgroundColor:
                      selectedRelationship === type.value
                        ? theme.primary
                        : theme.backgroundSecondary,
                    borderColor:
                      selectedRelationship === type.value
                        ? theme.primary
                        : theme.border,
                  },
                ]}
                onPress={() => {
                  setSelectedRelationship(type.value);
                  setInviterRole(null);
                  setInviteeRole(null);
                }}
              >
                <ThemedText
                  type="body"
                  style={{
                    color: selectedRelationship === type.value ? "#fff" : theme.text,
                    textAlign: "center",
                  }}
                >
                  {type.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>

        {selectedRelationshipData && selectedRelationshipData.roles[0] !== selectedRelationshipData.roles[1] && (
          <View style={styles.formGroup}>
            <ThemedText type="h4" style={styles.label}>
              Your Role
            </ThemedText>
            <View style={styles.roleOptions}>
              {selectedRelationshipData.roles.map((role) => (
                <Pressable
                  key={`inviter-${role}`}
                  style={[
                    styles.roleOption,
                    {
                      backgroundColor:
                        inviterRole === role ? theme.primary : theme.backgroundSecondary,
                      borderColor: inviterRole === role ? theme.primary : theme.border,
                    },
                  ]}
                  onPress={() => {
                    setInviterRole(role);
                    const otherRole = selectedRelationshipData.roles.find((r) => r !== role);
                    setInviteeRole(otherRole || role);
                  }}
                >
                  <ThemedText
                    type="body"
                    style={{ color: inviterRole === role ? "#fff" : theme.text }}
                  >
                    I'm the {role}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {selectedRelationshipData && selectedRelationshipData.roles[0] === selectedRelationshipData.roles[1] && (
          <View style={{ display: "none" }}>
            {(() => {
              if (!inviterRole) {
                setInviterRole(selectedRelationshipData.roles[0]);
                setInviteeRole(selectedRelationshipData.roles[1]);
              }
              return null;
            })()}
          </View>
        )}

        <View style={styles.formGroup}>
          <ThemedText type="h4" style={styles.label}>
            Personal Message (Optional)
          </ThemedText>
          <TextInput
            style={[
              styles.input,
              styles.textArea,
              {
                backgroundColor: theme.inputBackground,
                borderColor: theme.border,
                color: theme.text,
              },
            ]}
            placeholder="Write a heartfelt message explaining why you'd like to connect..."
            placeholderTextColor={theme.textSecondary}
            value={personalMessage}
            onChangeText={setPersonalMessage}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <Button
          title="Send Invitation"
          onPress={handleSubmit}
          loading={isSubmitting}
          disabled={!email || !selectedRelationship || !inviterRole}
          style={{ marginTop: Spacing.lg }}
        />

        <Card elevation={1} style={styles.infoCard}>
          <Feather name="info" size={20} color={theme.primary} />
          <View style={styles.infoContent}>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Your invitation will be sent via email. They'll create an account to accept and start 
              having meaningful conversations with you.
            </ThemedText>
          </View>
        </Card>
      </KeyboardAwareScrollViewCompat>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  title: {
    marginBottom: Spacing.sm,
  },
  formGroup: {
    marginBottom: Spacing.xl,
  },
  label: {
    marginBottom: Spacing.sm,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    fontSize: 16,
  },
  textArea: {
    height: 100,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
  },
  relationshipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  relationshipOption: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    minWidth: "45%",
    flexGrow: 1,
  },
  roleOptions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  roleOption: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    alignItems: "center",
  },
  infoCard: {
    marginTop: Spacing.xl,
    padding: Spacing.lg,
    flexDirection: "row",
    gap: Spacing.md,
    alignItems: "flex-start",
  },
  infoContent: {
    flex: 1,
  },
});
