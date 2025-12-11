import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { 
  Database, 
  Edit, 
  Trash2, 
  Search, 
  RefreshCw,
  Eye,
  Plus,
  Download,
  Upload
} from "lucide-react";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface TableColumn {
  name: string;
  type: string;
  nullable: boolean;
  default?: string;
}

interface TableData {
  name: string;
  columns: TableColumn[];
  rowCount: number;
}

export default function AdminDatabaseBrowser() {
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [editingRow, setEditingRow] = useState<any>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get list of database tables
  const { data: tables, isLoading: tablesLoading } = useQuery({
    queryKey: ['/api/admin/database/tables'],
    refetchInterval: 60000
  });

  // Get table data
  const { data: tableData, isLoading: dataLoading } = useQuery({
    queryKey: ['/api/admin/database/table-data', selectedTable, page, searchQuery],
    enabled: !!selectedTable,
    refetchInterval: 30000
  });

  // Update row mutation
  const updateRowMutation = useMutation({
    mutationFn: async ({ table, id, data }: { table: string, id: string, data: any }) => {
      return apiRequest('PATCH', `/api/admin/database/${table}/${id}`, data);
    },
    onSuccess: () => {
      toast({ title: "Row updated successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/database/table-data'] });
      setEditingRow(null);
    },
    onError: (error: any) => {
      toast({ 
        title: "Update failed", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  // Delete row mutation
  const deleteRowMutation = useMutation({
    mutationFn: async ({ table, id }: { table: string, id: string }) => {
      return apiRequest('DELETE', `/api/admin/database/${table}/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Row deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/database/table-data'] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Delete failed", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  const handleUpdateRow = (data: any) => {
    if (editingRow && selectedTable) {
      updateRowMutation.mutate({
        table: selectedTable,
        id: editingRow.id,
        data
      });
    }
  };

  const handleDeleteRow = (id: string) => {
    if (window.confirm('Are you sure you want to delete this row? This action cannot be undone.')) {
      deleteRowMutation.mutate({
        table: selectedTable,
        id
      });
    }
  };

  const exportTableData = async () => {
    if (!selectedTable) return;
    
    try {
      const response = await fetch(`/api/admin/database/export/${selectedTable}`, {
        credentials: 'include'
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedTable}_export.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast({ 
        title: "Export failed", 
        description: "Failed to export table data",
        variant: "destructive" 
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Database className="h-5 w-5 mr-2" />
            Database Browser
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <Select value={selectedTable} onValueChange={setSelectedTable}>
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue placeholder="Select a table" />
              </SelectTrigger>
              <SelectContent>
                {tables?.map((table: TableData) => (
                  <SelectItem key={table.name} value={table.name}>
                    {table.name} ({table.rowCount} rows)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedTable && (
              <>
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search table data..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                
                <Button variant="outline" onClick={exportTableData}>
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </>
            )}
          </div>

          {selectedTable && tableData && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge variant="secondary">
                  {tableData.total} total rows
                </Badge>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/admin/database/table-data'] })}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      {tableData.columns.map((column: TableColumn) => (
                        <th key={column.name} className="p-3 text-left font-medium">
                          {column.name}
                          <span className="text-xs text-muted-foreground ml-1">
                            ({column.type})
                          </span>
                        </th>
                      ))}
                      <th className="p-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableData.rows.map((row: any, index: number) => (
                      <tr key={index} className="border-b hover:bg-muted/50">
                        {tableData.columns.map((column: TableColumn) => (
                          <td key={column.name} className="p-3">
                            {formatCellValue(row[column.name], column.type)}
                          </td>
                        ))}
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => setEditingRow(row)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl">
                                <DialogHeader>
                                  <DialogTitle>Edit Row</DialogTitle>
                                </DialogHeader>
                                {editingRow && (
                                  <EditRowForm 
                                    row={editingRow}
                                    columns={tableData.columns}
                                    onSave={handleUpdateRow}
                                    onCancel={() => setEditingRow(null)}
                                  />
                                )}
                              </DialogContent>
                            </Dialog>
                            
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteRow(row.id || row.sid)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {tableData.totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Showing {(page - 1) * 50 + 1} to {Math.min(page * 50, tableData.total)} of {tableData.total} rows
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 1}
                      onClick={() => setPage(page - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= tableData.totalPages}
                      onClick={() => setPage(page + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function formatCellValue(value: any, type: string): string {
  if (value === null || value === undefined) {
    return '-';
  }
  
  if (type.includes('timestamp') || type.includes('date')) {
    return format(new Date(value), 'MMM dd, yyyy h:mm a');
  }
  
  if (type === 'boolean') {
    return value ? '✓' : '✗';
  }
  
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  
  const stringValue = String(value);
  return stringValue.length > 100 ? `${stringValue.substring(0, 100)}...` : stringValue;
}

function EditRowForm({ 
  row, 
  columns, 
  onSave, 
  onCancel 
}: { 
  row: any, 
  columns: TableColumn[], 
  onSave: (data: any) => void, 
  onCancel: () => void 
}) {
  const [formData, setFormData] = useState(row);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
        {columns.map((column) => (
          <div key={column.name}>
            <Label htmlFor={column.name} className="text-sm font-medium">
              {column.name}
              <span className="text-xs text-muted-foreground ml-1">
                ({column.type})
              </span>
              {!column.nullable && <span className="text-red-500 ml-1">*</span>}
            </Label>
            
            {column.type.includes('text') || column.name.includes('content') ? (
              <Textarea
                id={column.name}
                value={formData[column.name] || ''}
                onChange={(e) => setFormData({ ...formData, [column.name]: e.target.value })}
                className="mt-1"
                rows={3}
              />
            ) : column.type === 'boolean' ? (
              <Select 
                value={formData[column.name]?.toString() || 'false'} 
                onValueChange={(value) => setFormData({ ...formData, [column.name]: value === 'true' })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">True</SelectItem>
                  <SelectItem value="false">False</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Input
                id={column.name}
                type={column.type.includes('int') ? 'number' : 'text'}
                value={formData[column.name] || ''}
                onChange={(e) => setFormData({ ...formData, [column.name]: e.target.value })}
                className="mt-1"
                disabled={column.name === 'id' || column.name === 'created_at' || column.name === 'updated_at'}
              />
            )}
          </div>
        ))}
      </div>
      
      <Separator />
      
      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          Save Changes
        </Button>
      </div>
    </form>
  );
}